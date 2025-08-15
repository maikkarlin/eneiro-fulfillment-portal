// backend/routes/goodsReceipt.js - ERWEITERT mit /stats Endpoint + ZEIT-FIX
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Multer Konfiguration für Foto-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/warenannahme';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'warenannahme-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB Limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder sind erlaubt (JPEG, JPG, PNG, GIF)'));
    }
  }
});

// NEU: Stats Endpoint (für Frontend-Kompatibilität)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Lade Warenannahme-Statistiken...');
    
    const pool = await getConnection();
    const today = new Date().toISOString().split('T')[0];
    
    // Statistiken sammeln - NUR für Fulfillment-Kunden (kLabel = 2)
    const [
      heutigeAnlieferungen,
      offeneEinlagerungen,
      inBearbeitung,
      gesamtPackstuecke
    ] = await Promise.all([
      pool.request()
        .input('today', sql.Date, today)
        .query(`
          SELECT COUNT(*) as count 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE w.dDatum = @today AND kl.kLabel = 2
        `),
      
      pool.request()
        .query(`
          SELECT COUNT(*) as count 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE w.cStatus = 'Eingegangen' AND kl.kLabel = 2
        `),
      
      pool.request()
        .query(`
          SELECT COUNT(*) as count 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE w.cStatus = 'In Bearbeitung' AND kl.kLabel = 2
        `),
      
      pool.request()
        .query(`
          SELECT ISNULL(SUM(w.nAnzahlPackstuecke), 0) as count 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE kl.kLabel = 2
        `)
    ]);

    const stats = {
      heutigeAnlieferungen: heutigeAnlieferungen.recordset[0].count,
      offeneEinlagerungen: offeneEinlagerungen.recordset[0].count,
      inBearbeitung: inBearbeitung.recordset[0].count,
      gesamtPackstuecke: gesamtPackstuecke.recordset[0].count,
      // Alias für Frontend-Kompatibilität:
      HeutigeAnlieferungen: heutigeAnlieferungen.recordset[0].count,
      OffeneEinlagerungen: offeneEinlagerungen.recordset[0].count,
      InBearbeitung: inBearbeitung.recordset[0].count,
      GesamtPackstuecke: gesamtPackstuecke.recordset[0].count
    };

    console.log('✅ Statistiken geladen:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// Alle Warenannahmen für Mitarbeiter abrufen (nur Fulfillment-Kunden)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur für Mitarbeiter' });
    }

    console.log('📦 Lade alle Warenannahmen...');

    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
          w.kKunde,
          w.cTransporteur,
          w.cPackstueckArt,
          w.nAnzahlPackstuecke,
          w.cZustand,
          w.bPalettentausch,
          w.cJTLLieferantenbestellnummer,
          w.cAnmerkung,
          w.cFotoPath,
          w.kBenutzer,
          w.cStatus,
          w.dErstellt,
          w.dGeaendert,
          k.cKundenNr,
          a.cFirma AS KundenFirma,
          b.cName AS MitarbeiterName
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE kl.kLabel = 2
        ORDER BY w.dDatum DESC, w.tUhrzeit DESC
      `);
    
    console.log(`✅ ${result.recordset.length} Warenannahmen geladen`);
    
    res.json({
      message: 'Warenannahmen erfolgreich geladen',
      count: result.recordset.length,
      data: result.recordset
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahmen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahmen' });
  }
});

// Alle Warenannahmen für angemeldeten Kunden abrufen (nur Fulfillment-Kunden)
router.get('/customer', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Nur für Kunden' });
    }

    console.log('📦 Lade Warenannahmen für Kunde:', req.user.customerNumber);

    // Hole kKunde basierend auf der Kundennummer UND prüfe kLabel = 2
    const pool = await getConnection();
    const customerResult = await pool.request()
      .input('customerNumber', sql.NVarChar, req.user.customerNumber)
      .query(`
        SELECT k.kKunde 
        FROM tKunde k
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE k.cKundenNr = @customerNumber AND kl.kLabel = 2
      `);

    if (customerResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Fulfillment-Kunde nicht gefunden' });
    }

    const kKunde = customerResult.recordset[0].kKunde;

    // Hole alle Warenannahmen für diesen Fulfillment-Kunden
    const warenannahmenResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
          w.kKunde,
          w.cTransporteur,
          w.cPackstueckArt,
          w.nAnzahlPackstuecke,
          w.cZustand,
          w.bPalettentausch,
          w.cJTLLieferantenbestellnummer,
          w.cAnmerkung,
          w.cFotoPath,
          w.kBenutzer,
          w.cStatus,
          w.dErstellt,
          w.dGeaendert,
          a.cFirma as KundenFirma,
          b.cName as MitarbeiterName
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        WHERE w.kKunde = @kKunde
        ORDER BY w.dDatum DESC, w.tUhrzeit DESC
      `);

    console.log(`✅ ${warenannahmenResult.recordset.length} Warenannahmen für Kunde ${req.user.customerNumber} geladen`);

    res.json({
      message: 'Warenannahmen erfolgreich geladen',
      count: warenannahmenResult.recordset.length,
      data: warenannahmenResult.recordset
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Kundenwarenannahmen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahmen' });
  }
});

// Einzelne Warenannahme abrufen (nur für Mitarbeiter, nur Fulfillment-Kunden)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // ✅ ROLLE ÜBERPRÜFEN: Nur Mitarbeiter können Details laden
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur für Mitarbeiter' });
    }

    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📦 Lade Warenannahme ID:', kWarenannahme, 'für Mitarbeiter');

    const pool = await getConnection();
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
          w.kKunde,
          w.cTransporteur,
          w.cPackstueckArt,
          w.nAnzahlPackstuecke,
          w.cZustand,
          w.bPalettentausch,
          w.cJTLLieferantenbestellnummer,
          w.cAnmerkung,
          w.cFotoPath,
          w.kBenutzer,
          w.cStatus,
          w.dErstellt,
          w.dGeaendert,
          k.cKundenNr,
          a.cFirma AS KundenFirma,
          b.cName AS MitarbeiterName
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE w.kWarenannahme = @kWarenannahme AND kl.kLabel = 2
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden oder kein Fulfillment-Kunde' });
    }
    
    console.log('✅ Warenannahme Details geladen für Mitarbeiter');
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Einzelne Warenannahme für Kunden abrufen (nur Fulfillment-Kunden)
router.get('/customer/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Nur für Kunden' });
    }

    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📦 Lade Warenannahme für Kunde:', req.user.customerNumber, 'ID:', kWarenannahme);

    const pool = await getConnection();
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .input('customerNumber', sql.NVarChar, req.user.customerNumber)
      .query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
          w.kKunde,
          w.cTransporteur,
          w.cPackstueckArt,
          w.nAnzahlPackstuecke,
          w.cZustand,
          w.bPalettentausch,
          w.cJTLLieferantenbestellnummer,
          w.cAnmerkung,
          w.cFotoPath,
          w.kBenutzer,
          w.cStatus,
          w.dErstellt,
          w.dGeaendert,
          k.cKundenNr,
          a.cFirma AS KundenFirma,
          b.cName AS MitarbeiterName
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE w.kWarenannahme = @kWarenannahme 
          AND k.cKundenNr = @customerNumber 
          AND kl.kLabel = 2
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden oder kein Zugriff' });
    }
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Kundenwarenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Neue Warenannahme erstellen - ✅ ZEIT-FIX HIER!
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Warenannahmen erstellen' });
    }

    console.log('📦 Erstelle neue Warenannahme...');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const {
      kKunde,
      cTransporteur,
      cPackstueckArt,
      nAnzahlPackstuecke,
      cZustand,
      bPalettentausch,
      cJTLLieferantenbestellnummer,
      cAnmerkung,
      dDatum,    // ✅ NEU: Falls Frontend spezifisches Datum sendet
      tUhrzeit   // ✅ NEU: Falls Frontend spezifische Zeit sendet
    } = req.body;

    // Validierung
    if (!kKunde || !cTransporteur || !cPackstueckArt || !nAnzahlPackstuecke) {
      return res.status(400).json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden' });
    }

    // Prüfe ob es ein Fulfillment-Kunde ist
    const pool = await getConnection();
    const customerCheck = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT k.kKunde, k.cKundenNr 
        FROM tKunde k
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE k.kKunde = @kKunde AND kl.kLabel = 2
      `);

    if (customerCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Kein gültiger Fulfillment-Kunde' });
    }

    const fotoPath = req.file ? req.file.filename : null;
    const now = new Date();

    // ✅ DATETIME-TRICK: MSSQL TIME via DateTime umgehen
    let finalDate, timeStr;
    
    if (dDatum) {
      finalDate = dDatum; // Frontend sendet bereits ISO-Format
    } else {
      finalDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    if (tUhrzeit) {
      timeStr = tUhrzeit; // Frontend: "19:07"
      console.log('🕐 Zeit vom Frontend:', tUhrzeit);
    } else {
      timeStr = now.toTimeString().slice(0, 5); // "HH:mm"
    }

    // DateTime-Objekt für TIME-Umgehung erstellen
    const combinedDateTime = new Date(`${finalDate}T${timeStr}:00`);
    
    console.log('📅 Finale Werte - Datum:', finalDate, 'Zeit:', timeStr);
    console.log('🔄 Combined DateTime:', combinedDateTime);

    const result = await pool.request()
      .input('dDatum', sql.Date, finalDate)
      .input('dDateTime', sql.DateTime, combinedDateTime) // ✅ DateTime statt Time
      .input('kKunde', sql.Int, kKunde)
      .input('cTransporteur', sql.NVarChar, cTransporteur)
      .input('cPackstueckArt', sql.NVarChar, cPackstueckArt)
      .input('nAnzahlPackstuecke', sql.Int, nAnzahlPackstuecke)
      .input('cZustand', sql.NVarChar, cZustand || 'Gut')
      .input('bPalettentausch', sql.Bit, bPalettentausch === 'true' || bPalettentausch === true)
      .input('cJTLLieferantenbestellnummer', sql.NVarChar, cJTLLieferantenbestellnummer || null)
      .input('cAnmerkung', sql.NVarChar, cAnmerkung || null)
      .input('cFotoPath', sql.NVarChar, fotoPath)
      .input('kBenutzer', sql.Int, req.user.id)
      .input('cStatus', sql.NVarChar, 'Eingegangen')
      .query(`
        INSERT INTO tWarenannahme (
          dDatum, tUhrzeit, kKunde, cTransporteur, cPackstueckArt, 
          nAnzahlPackstuecke, cZustand, bPalettentausch, 
          cJTLLieferantenbestellnummer, cAnmerkung, cFotoPath, 
          kBenutzer, cStatus, dErstellt, dGeaendert
        ) VALUES (
          @dDatum, CAST(@dDateTime AS time), @kKunde, @cTransporteur, @cPackstueckArt,
          @nAnzahlPackstuecke, @cZustand, @bPalettentausch,
          @cJTLLieferantenbestellnummer, @cAnmerkung, @cFotoPath,
          @kBenutzer, @cStatus, GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() as kWarenannahme;
      `);

    const kWarenannahme = result.recordset[0].kWarenannahme;

    console.log('✅ Warenannahme erstellt:', kWarenannahme);

    res.json({
      message: 'Warenannahme erfolgreich erstellt',
      kWarenannahme,
      fotoPath
    });

  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Warenannahme: ' + error.message });
  }
});

// Warenannahme aktualisieren
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Warenannahmen bearbeiten' });
    }

    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📦 Aktualisiere Warenannahme:', kWarenannahme);

    const {
      cTransporteur,
      cPackstueckArt,
      nAnzahlPackstuecke,
      cZustand,
      bPalettentausch,
      cJTLLieferantenbestellnummer,
      cAnmerkung
    } = req.body;

    const pool = await getConnection();

    // Erstelle UPDATE Query
    let updateQuery = `
      UPDATE tWarenannahme 
      SET 
        cTransporteur = @cTransporteur,
        cPackstueckArt = @cPackstueckArt,
        nAnzahlPackstuecke = @nAnzahlPackstuecke,
        cZustand = @cZustand,
        bPalettentausch = @bPalettentausch,
        cJTLLieferantenbestellnummer = @cJTLLieferantenbestellnummer,
        cAnmerkung = @cAnmerkung,
        dGeaendert = GETDATE()
    `;

    const request = pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .input('cTransporteur', sql.NVarChar, cTransporteur)
      .input('cPackstueckArt', sql.NVarChar, cPackstueckArt)
      .input('nAnzahlPackstuecke', sql.Int, nAnzahlPackstuecke)
      .input('cZustand', sql.NVarChar, cZustand || 'Gut')
      .input('bPalettentausch', sql.Bit, bPalettentausch === 'true' || bPalettentausch === true)
      .input('cJTLLieferantenbestellnummer', sql.NVarChar, cJTLLieferantenbestellnummer || null)
      .input('cAnmerkung', sql.NVarChar, cAnmerkung || null);

    // Wenn neues Foto hochgeladen wurde
    if (req.file) {
      updateQuery += `, cFotoPath = @cFotoPath`;
      request.input('cFotoPath', sql.NVarChar, req.file.filename);
    }

    updateQuery += ` WHERE kWarenannahme = @kWarenannahme`;

    await request.query(updateQuery);

    console.log('✅ Warenannahme aktualisiert');

    res.json({
      message: 'Warenannahme erfolgreich aktualisiert',
      fotoPath: req.file ? req.file.filename : null
    });

  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Warenannahme' });
  }
});

// Status aktualisieren (nur für Mitarbeiter)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können den Status ändern' });
    }

    const { id } = req.params;
    const { cStatus } = req.body;
    const kWarenannahme = parseInt(id);
    
    console.log('📦 Aktualisiere Status für Warenannahme:', kWarenannahme, 'auf:', cStatus);

    const pool = await getConnection();
    await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .input('cStatus', sql.NVarChar, cStatus)
      .query(`
        UPDATE tWarenannahme 
        SET cStatus = @cStatus, dGeaendert = GETDATE()
        WHERE kWarenannahme = @kWarenannahme
      `);
    
    console.log('✅ Status aktualisiert für Warenannahme');
    
    res.json({ message: 'Status aktualisiert' });
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren des Status:', error);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Status' });
  }
});

// Warenannahme löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Warenannahmen löschen' });
    }

    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('🗑️ Lösche Warenannahme:', kWarenannahme);

    const pool = await getConnection();
    
    // Erst Foto-Pfad abrufen um Datei zu löschen
    const photoResult = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query('SELECT cFotoPath FROM tWarenannahme WHERE kWarenannahme = @kWarenannahme');
    
    // Datensatz löschen
    await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query('DELETE FROM tWarenannahme WHERE kWarenannahme = @kWarenannahme');
    
    // Foto-Datei löschen falls vorhanden
    if (photoResult.recordset[0]?.cFotoPath) {
      const filePath = path.join('uploads/warenannahme', photoResult.recordset[0].cFotoPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    console.log('✅ Warenannahme gelöscht');
    res.json({ message: 'Warenannahme erfolgreich gelöscht' });

  } catch (error) {
    console.error('❌ Fehler beim Löschen der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Warenannahme' });
  }
});

module.exports = router;