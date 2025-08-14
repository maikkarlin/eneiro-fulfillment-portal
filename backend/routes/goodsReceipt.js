// backend/routes/goodsReceipt.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Multer Konfiguration für Foto-Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/goods-receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'WA-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien (jpeg, jpg, png, gif) sind erlaubt'));
    }
  }
});

// Test-Route (keine Auth erforderlich)
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Test-Route für Warenannahme (nur Fulfillment-Kunden mit kLabel = 2)...');
    
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        w.kWarenannahme,
        w.dDatum,
        CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
        w.kKunde,
        w.cTransporteur,
        w.cPackstueckArt,
        w.nAnzahlPackstuecke,
        w.cStatus,
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
        LEFT JOIN tAdresse a ON w.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        WHERE w.kKunde = @kKunde
        ORDER BY w.dDatum DESC, w.tUhrzeit DESC
      `);

    console.log(`✅ ${warenannahmenResult.recordset.length} Warenannahmen für Kunde gefunden`);
    res.json(warenannahmenResult.recordset);
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Kunden-Warenannahmen:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Warenannahmen' });
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
        CONVERT(VARCHAR(5), w.tUhrzeit, 108) AS tUhrzeit,
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
    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📦 Lade Warenannahme ID:', kWarenannahme);

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
    
    // Datum und Zeit richtig formatieren für SQL Server
    const currentDate = new Date();
    const dateValue = req.body.dDatum || currentDate.toISOString().split('T')[0];
    
    // Zeit als JavaScript Date Object erstellen für korrekte SQL Server Konvertierung
    let timeValue;
    if (req.body.tUhrzeit) {
      const [hours, minutes] = req.body.tUhrzeit.split(':');
      timeValue = new Date();
      timeValue.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      timeValue = currentDate;
    }

    // Daten vorbereiten
    const insertData = {
      dDatum: dateValue,
      tUhrzeit: timeValue,
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
          SELECT ISNULL(SUM(w.nAnzahlPackstuecke), 0) as count 
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
          WHERE kl.kLabel = 2
        `)
    ]);

    res.json({
      heutigeAnlieferungen: heutigeAnlieferungen.recordset[0].count,
      offeneEinlagerungen: offeneEinlagerungen.recordset[0].count,
      inBearbeitung: inBearbeitung.recordset[0].count,
      gesamtPackstuecke: gesamtPackstuecke.recordset[0].count
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

// Löschen (nur für Mitarbeiter)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = await getConnection();
    
    // Prüfe ob Warenannahme existiert und zu Fulfillment-Kunde gehört
    const checkResult = await pool.request()
      .input('kWarenannahme', sql.Int, parseInt(id))
      .query(`
        SELECT w.kWarenannahme, w.cFotoPath 
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE w.kWarenannahme = @kWarenannahme AND kl.kLabel = 2
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden oder kein Fulfillment-Kunde' });
    }
    
    // TODO: Foto löschen wenn vorhanden
    // const fotoPath = checkResult.recordset[0].cFotoPath;
    
    await pool.request()
      .input('kWarenannahme', sql.Int, parseInt(id))
      .query('DELETE FROM tWarenannahme WHERE kWarenannahme = @kWarenannahme');
    
    res.json({ message: 'Warenannahme gelöscht' });
  } catch (error) {
    console.error('❌ Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

// GET /api/goods-receipt/stats - Warenannahme Statistiken
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Lade Warenannahme-Statistiken...');
    
    const connection = await getConnection();
    
    // Einfache Statistiken für Mitarbeiter-Dashboard
    const [results] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Eingegangen' THEN 1 END) as eingegangen,
        COUNT(CASE WHEN status = 'Bearbeitet' THEN 1 END) as bearbeitet,
        COUNT(CASE WHEN status = 'Abgeschlossen' THEN 1 END) as abgeschlossen,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as heute,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as diese_woche,
        COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as dieser_monat
      FROM warenannahme
      WHERE 1=1
    `);
    
    const stats = results[0] || {
      total: 0,
      eingegangen: 0, 
      bearbeitet: 0,
      abgeschlossen: 0,
      heute: 0,
      diese_woche: 0,
      dieser_monat: 0
    };
    
    console.log('✅ Statistiken geladen:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahme-Statistiken:', error);
    
    // Fallback-Statistiken wenn Tabelle nicht existiert
    res.json({
      total: 0,
      eingegangen: 0,
      bearbeitet: 0, 
      abgeschlossen: 0,
      heute: 0,
      diese_woche: 0,
      dieser_monat: 0
    });
  }
});


module.exports = router;
