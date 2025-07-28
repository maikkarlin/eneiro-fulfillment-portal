// backend/routes/goodsReceipt.js - FINALE VERSION MIT kLabel = 2 FILTER

const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Konfiguration für Foto-Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/warenannahme');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `WA-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder erlaubt (JPEG, PNG, GIF)'));
    }
  }
});

// === TEST-ROUTE OHNE AUTHENTIFIZIERUNG ===
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Test-Route für Warenannahme aufgerufen');
    
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 5 
        w.*,
        k.cKundenNr,
        a.cFirma AS KundenFirma
      FROM tWarenannahme w
      LEFT JOIN tKunde k ON w.kKunde = k.kKunde
      LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
      LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
      WHERE kl.kLabel = 2
      ORDER BY w.dDatum DESC
    `);
    
    res.json({
      message: 'Warenannahme API funktioniert!',
      count: result.recordset.length,
      data: result.recordset
    });
    
  } catch (error) {
    console.error('❌ Fehler in Test-Route:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Test-Daten' });
  }
});

// Alle Warenannahmen abrufen (nur für Mitarbeiter, nur Fulfillment-Kunden)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Lade alle Warenannahmen (nur Fulfillment-Kunden)...');
    
    const pool = await getConnection();
    const request = pool.request();
    
    // Base Query mit kLabel = 2 Filter
    let whereClause = 'WHERE kl.kLabel = 2';
    
    // Filter aus Query-Parametern
    if (req.query.dateFrom) {
      whereClause += ' AND w.dDatum >= @dateFrom';
      request.input('dateFrom', sql.Date, req.query.dateFrom);
    }
    
    if (req.query.dateTo) {
      whereClause += ' AND w.dDatum <= @dateTo';
      request.input('dateTo', sql.Date, req.query.dateTo);
    }
    
    if (req.query.status) {
      whereClause += ' AND w.cStatus = @status';
      request.input('status', sql.NVarChar, req.query.status);
    }
    
    if (req.query.kKunde) {
      whereClause += ' AND w.kKunde = @kKunde';
      request.input('kKunde', sql.Int, parseInt(req.query.kKunde));
    }

    const result = await request.query(`
      SELECT 
        w.kWarenannahme,
        w.dDatum,
        w.tUhrzeit,
        w.kKunde,
        k.cKundenNr,
        a.cFirma AS KundenFirma,
        w.cTransporteur,
        w.cPackstueckArt,
        w.nAnzahlPackstuecke,
        w.cZustand,
        w.bPalettentausch,
        w.cJTLLieferantenbestellnummer,
        w.cAnmerkung,
        w.cFotoPath,
        w.kBenutzer,
        b.cName AS MitarbeiterName,
        w.cStatus,
        w.dErstellt,
        w.dGeaendert
      FROM tWarenannahme w
      LEFT JOIN tKunde k ON w.kKunde = k.kKunde
      LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
      LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
      LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
      ${whereClause}
      ORDER BY w.dDatum DESC, w.tUhrzeit DESC
    `);
    
    console.log(`✅ ${result.recordset.length} Warenannahmen gefunden (nur Fulfillment)`);
    res.json(result.recordset);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahmen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahmen' });
  }
});

// Einzelne Warenannahme abrufen (nur für Mitarbeiter, nur Fulfillment-Kunden)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const kWarenannahme = parseInt(req.params.id);
    console.log('📦 Lade Warenannahme:', kWarenannahme);
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query(`
        SELECT 
          w.*,
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
    
    res.json(result.recordset[0]);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Neue Warenannahme erstellen (nur für Mitarbeiter, nur für Fulfillment-Kunden)
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    console.log('📦 Erstelle neue Warenannahme...');
    console.log('Request Body:', req.body);
    console.log('Uploaded File:', req.file);
    
    // Validierung
    const requiredFields = ['kKunde', 'cTransporteur', 'cPackstueckArt', 'nAnzahlPackstuecke'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Feld ${field} ist erforderlich` });
      }
    }
    
    const kKunde = parseInt(req.body.kKunde);
    
    // WICHTIG: Prüfe ob der ausgewählte Kunde ein Fulfillment-Kunde ist (kLabel = 2)
    console.log('🔍 Prüfe Fulfillment-Status für Kunde:', kKunde);
    
    const pool = await getConnection();
    const kundeCheck = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT k.kKunde, k.cKundenNr, a.cFirma
        FROM tKunde k
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE k.kKunde = @kKunde AND kl.kLabel = 2
      `);

    console.log('Kunde-Check Ergebnis:', kundeCheck.recordset);

    if (kundeCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Ausgewählter Kunde ist kein Fulfillment-Kunde (kLabel = 2)' });
    }
    
    // Foto-Pfad wenn hochgeladen
    const cFotoPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    
    // Benutzer aus Token ermitteln - erstmal Fallback
    const kBenutzer = req.user.id || 1; // Fallback zu Admin
    
    // Daten vorbereiten
    const insertData = {
      dDatum: req.body.dDatum || new Date().toISOString().split('T')[0],
      tUhrzeit: req.body.tUhrzeit || new Date().toTimeString().slice(0, 8),
      kKunde: kKunde,
      kBenutzer: kBenutzer,
      cTransporteur: req.body.cTransporteur,
      cPackstueckArt: req.body.cPackstueckArt,
      nAnzahlPackstuecke: parseInt(req.body.nAnzahlPackstuecke),
      cZustand: req.body.cZustand || 'In Ordnung',
      bPalettentausch: req.body.bPalettentausch === 'true' || req.body.bPalettentausch === true,
      cJTLLieferantenbestellnummer: req.body.cJTLLieferantenbestellnummer || null,
      cAnmerkung: req.body.cAnmerkung || null,
      cFotoPath: cFotoPath,
      cStatus: 'Eingegangen'
    };

    console.log('📝 Insert-Daten:', insertData);
    
    // INSERT mit OUTPUT um die ID zu bekommen
    const insertResult = await pool.request()
      .input('dDatum', sql.Date, insertData.dDatum)
      .input('tUhrzeit', sql.Time, insertData.tUhrzeit)
      .input('kKunde', sql.Int, insertData.kKunde)
      .input('kBenutzer', sql.Int, insertData.kBenutzer)
      .input('cTransporteur', sql.NVarChar, insertData.cTransporteur)
      .input('cPackstueckArt', sql.NVarChar, insertData.cPackstueckArt)
      .input('nAnzahlPackstuecke', sql.Int, insertData.nAnzahlPackstuecke)
      .input('cZustand', sql.NVarChar, insertData.cZustand)
      .input('bPalettentausch', sql.Bit, insertData.bPalettentausch)
      .input('cJTLLieferantenbestellnummer', sql.NVarChar, insertData.cJTLLieferantenbestellnummer)
      .input('cAnmerkung', sql.NVarChar, insertData.cAnmerkung)
      .input('cFotoPath', sql.NVarChar, insertData.cFotoPath)
      .input('cStatus', sql.NVarChar, insertData.cStatus)
      .query(`
        INSERT INTO tWarenannahme (
          dDatum, tUhrzeit, kKunde, kBenutzer, cTransporteur,
          cPackstueckArt, nAnzahlPackstuecke, cZustand, bPalettentausch,
          cJTLLieferantenbestellnummer, cAnmerkung, cFotoPath, cStatus
        ) 
        OUTPUT INSERTED.kWarenannahme
        VALUES (
          @dDatum, @tUhrzeit, @kKunde, @kBenutzer, @cTransporteur,
          @cPackstueckArt, @nAnzahlPackstuecke, @cZustand, @bPalettentausch,
          @cJTLLieferantenbestellnummer, @cAnmerkung, @cFotoPath, @cStatus
        )
      `);
    
    const newId = insertResult.recordset[0].kWarenannahme;
    console.log('✅ Neue Warenannahme erstellt mit ID:', newId);
    
    // Hole die erstellte Warenannahme mit allen Details
    const newReceipt = await pool.request()
      .input('kWarenannahme', sql.Int, newId)
      .query(`
        SELECT 
          w.*,
          a.cFirma as KundenFirma,
          b.cName as MitarbeiterName,
          k.cKundenNr
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        WHERE w.kWarenannahme = @kWarenannahme
      `);
    
    res.status(201).json({
      message: 'Warenannahme erfolgreich erstellt',
      kWarenannahme: newId,
      goodsReceipt: newReceipt.recordset[0]
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Warenannahme: ' + error.message });
  }
});

// Status aktualisieren (nur für Mitarbeiter)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { cStatus } = req.body;
    
    const allowedStatuses = ['Eingegangen', 'In Einlagerung', 'Eingelagert'];
    if (!allowedStatuses.includes(cStatus)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    
    const pool = await getConnection();
    
    // Prüfe ob Warenannahme existiert und zu Fulfillment-Kunde gehört
    const checkResult = await pool.request()
      .input('kWarenannahme', sql.Int, parseInt(id))
      .query(`
        SELECT w.kWarenannahme 
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE w.kWarenannahme = @kWarenannahme AND kl.kLabel = 2
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden oder kein Fulfillment-Kunde' });
    }
    
    await pool.request()
      .input('cStatus', sql.NVarChar, cStatus)
      .input('kWarenannahme', sql.Int, parseInt(id))
      .query('UPDATE tWarenannahme SET cStatus = @cStatus WHERE kWarenannahme = @kWarenannahme');
    
    res.json({ message: 'Status aktualisiert' });
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren des Status:', error);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Status' });
  }
});

// Dashboard-Statistiken (nur Fulfillment-Kunden)
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Lade Warenannahme-Statistiken (nur Fulfillment)...');
    
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
          WHERE w.cStatus = 'In Einlagerung' AND kl.kLabel = 2
        `),
      
      pool.request()
        .query(`
          SELECT SUM(w.nAnzahlPackstuecke) as total 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE MONTH(w.dDatum) = MONTH(GETDATE()) 
          AND YEAR(w.dDatum) = YEAR(GETDATE()) 
          AND kl.kLabel = 2
        `)
    ]);
    
    const stats = {
      HeutigeAnlieferungen: heutigeAnlieferungen.recordset[0].count,
      OffeneEinlagerungen: offeneEinlagerungen.recordset[0].count,
      InBearbeitung: inBearbeitung.recordset[0].count,
      GesamtPackstuecke: gesamtPackstuecke.recordset[0].total || 0
    };
    
    console.log('✅ Statistiken geladen:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

module.exports = router;