// backend/routes/documents.js - VOLLSTÄNDIGE DATEI
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Multer Konfiguration für PDF-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `lieferschein-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB Limit für PDFs
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt'));
    }
  }
});

// ===== LIEFERSCHEIN HOCHLADEN (nur Mitarbeiter) =====
router.post('/upload/:warenannahmeId', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Dokumente hochladen' });
    }

    const { warenannahmeId } = req.params;
    const { beschreibung } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    console.log('📄 Lade Lieferschein hoch für Warenannahme:', warenannahmeId);
    console.log('📎 Datei:', req.file.filename, 'Größe:', req.file.size);

    // Prüfe ob Warenannahme existiert und zu Fulfillment-Kunde gehört
    const pool = await getConnection();
    const warenannahmeCheck = await pool.request()
      .input('kWarenannahme', sql.Int, parseInt(warenannahmeId))
      .query(`
        SELECT w.kWarenannahme, k.cKundenNr 
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE w.kWarenannahme = @kWarenannahme AND kl.kLabel = 2
      `);

    if (warenannahmeCheck.recordset.length === 0) {
      // Datei wieder löschen
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Warenannahme nicht gefunden oder kein Fulfillment-Kunde' });
    }

    // Dokument in Datenbank speichern
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, parseInt(warenannahmeId))
      .input('cDokumentTyp', sql.NVarChar, 'Lieferschein')
      .input('cDateiName', sql.NVarChar, req.file.originalname)
      .input('cDateiPfad', sql.NVarChar, req.file.filename)
      .input('cMimeType', sql.NVarChar, req.file.mimetype)
      .input('nDateiGroesse', sql.BigInt, req.file.size)
      .input('cBeschreibung', sql.NVarChar, beschreibung || null)
      .input('kBenutzer', sql.Int, req.user.id)
      .query(`
        INSERT INTO tWarenannahmeDokument (
          kWarenannahme, cDokumentTyp, cDateiName, cDateiPfad, 
          cMimeType, nDateiGroesse, cBeschreibung, kBenutzer,
          dErstellt, dGeaendert
        ) VALUES (
          @kWarenannahme, @cDokumentTyp, @cDateiName, @cDateiPfad,
          @cMimeType, @nDateiGroesse, @cBeschreibung, @kBenutzer,
          GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() as kDokument;
      `);

    const kDokument = result.recordset[0].kDokument;

    console.log('✅ Lieferschein erfolgreich hochgeladen:', kDokument);

    res.json({
      message: 'Lieferschein erfolgreich hochgeladen',
      kDokument,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    // Bei Fehler Datei löschen
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('❌ Fehler beim Hochladen des Lieferscheins:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen: ' + error.message });
  }
});

// ===== DOKUMENTE EINER WARENANNAHME ABRUFEN =====
router.get('/warenannahme/:warenannahmeId', authenticateToken, async (req, res) => {
  try {
    const { warenannahmeId } = req.params;
    
    console.log('📄 Lade Dokumente für Warenannahme:', warenannahmeId, 'Rolle:', req.user.role);

    const pool = await getConnection();
    let query = '';
    
    if (req.user.role === 'employee') {
      // Mitarbeiter: Alle Dokumente von Fulfillment-Kunden
      query = `
        SELECT 
          d.kDokument,
          d.kWarenannahme,
          d.cDokumentTyp,
          d.cDateiName,
          d.cDateiPfad,
          d.cMimeType,
          d.nDateiGroesse,
          d.cBeschreibung,
          d.dErstellt,
          b.cName AS HochgeladenVon
        FROM tWarenannahmeDokument d
        LEFT JOIN tBenutzer b ON d.kBenutzer = b.kBenutzer
        LEFT JOIN tWarenannahme w ON d.kWarenannahme = w.kWarenannahme
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE d.kWarenannahme = @kWarenannahme AND kl.kLabel = 2
        ORDER BY d.dErstellt DESC
      `;
    } else {
      // Kunde: Nur eigene Dokumente
      query = `
        SELECT 
          d.kDokument,
          d.kWarenannahme,
          d.cDokumentTyp,
          d.cDateiName,
          d.cDateiPfad,
          d.cMimeType,
          d.nDateiGroesse,
          d.cBeschreibung,
          d.dErstellt,
          b.cName AS HochgeladenVon
        FROM tWarenannahmeDokument d
        LEFT JOIN tBenutzer b ON d.kBenutzer = b.kBenutzer
        LEFT JOIN tWarenannahme w ON d.kWarenannahme = w.kWarenannahme
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE d.kWarenannahme = @kWarenannahme 
          AND k.cKundenNr = @customerNumber 
          AND kl.kLabel = 2
        ORDER BY d.dErstellt DESC
      `;
    }

    const request = pool.request().input('kWarenannahme', sql.Int, parseInt(warenannahmeId));
    
    if (req.user.role === 'customer') {
      request.input('customerNumber', sql.NVarChar, req.user.customerNumber);
    }

    const result = await request.query(query);
    
    console.log('✅ Dokumente geladen:', result.recordset.length);
    res.json(result.recordset);

  } catch (error) {
    console.error('❌ Fehler beim Laden der Dokumente:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
  }
});

// ===== DOKUMENT HERUNTERLADEN/ANZEIGEN =====
router.get('/download/:dokumentId', async (req, res) => {
  try {
    const { dokumentId } = req.params;
    
    console.log('📥 Download Dokument:', dokumentId);
    
    // Token aus Header ODER URL-Parameter lesen
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
      console.log('🔑 Token aus Header erhalten');
    } else if (req.query.token) {
      token = req.query.token;
      console.log('🔑 Token aus URL Parameter erhalten');
    }
    
    if (!token) {
      console.log('❌ Kein Token gefunden');
      return res.status(401).json({ error: 'Token erforderlich' });
    }
    
    // Token manuell verifizieren (statt authenticateToken Middleware)
    let user = null;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      console.log('✅ Token verifiziert für Benutzer:', user.id, 'Rolle:', user.role);
    } catch (err) {
      console.log('❌ Token-Verifikation fehlgeschlagen:', err.message);
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    const pool = await getConnection();
    let query = '';

    if (user.role === 'employee') {
      // Mitarbeiter: Alle Dokumente von Fulfillment-Kunden
      query = `
        SELECT d.*, w.kKunde, k.cKundenNr
        FROM tWarenannahmeDokument d
        LEFT JOIN tWarenannahme w ON d.kWarenannahme = w.kWarenannahme
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE d.kDokument = @kDokument AND kl.kLabel = 2
      `;
    } else {
      // Kunde: Nur eigene Dokumente
      query = `
        SELECT d.*, w.kKunde, k.cKundenNr
        FROM tWarenannahmeDokument d
        LEFT JOIN tWarenannahme w ON d.kWarenannahme = w.kWarenannahme
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
        WHERE d.kDokument = @kDokument 
          AND k.cKundenNr = @customerNumber 
          AND kl.kLabel = 2
      `;
    }

    const request = pool.request().input('kDokument', sql.Int, parseInt(dokumentId));
    
    if (user.role === 'customer') {
      request.input('customerNumber', sql.NVarChar, user.customerNumber);
    }

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      console.log('❌ Dokument nicht gefunden oder kein Zugriff');
      return res.status(404).json({ error: 'Dokument nicht gefunden oder kein Zugriff' });
    }

    const dokument = result.recordset[0];
    const filePath = path.join(__dirname, '..', 'uploads', 'documents', dokument.cDateiPfad);
    
    console.log('📁 Dateipfad:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('❌ Datei existiert nicht:', filePath);
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    console.log('✅ Datei gefunden, sende PDF:', dokument.cDateiName);

    // Content-Type setzen
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${dokument.cDateiName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Datei streamen
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('❌ Datei-Stream Fehler:', error);
      res.status(500).json({ error: 'Fehler beim Lesen der Datei' });
    });
    
    fileStream.pipe(res);

    console.log('✅ Dokument gesendet:', dokument.cDateiName);

  } catch (error) {
    console.error('❌ Download-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Download: ' + error.message });
  }
});

// ===== DOKUMENT LÖSCHEN (nur Mitarbeiter) =====
router.delete('/:dokumentId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Dokumente löschen' });
    }

    const { dokumentId } = req.params;
    
    console.log('🗑️ Lösche Dokument:', dokumentId);

    const pool = await getConnection();
    
    // Dokument-Info abrufen für Datei-Löschung
    const dokument = await pool.request()
      .input('kDokument', sql.Int, parseInt(dokumentId))
      .query('SELECT cDateiPfad FROM tWarenannahmeDokument WHERE kDokument = @kDokument');
    
    if (dokument.recordset.length === 0) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    // Datensatz löschen
    await pool.request()
      .input('kDokument', sql.Int, parseInt(dokumentId))
      .query('DELETE FROM tWarenannahmeDokument WHERE kDokument = @kDokument');
    
    // Datei löschen
    const filePath = path.join('uploads/documents', dokument.recordset[0].cDateiPfad);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.log('✅ Dokument gelöscht');
    res.json({ message: 'Dokument erfolgreich gelöscht' });

  } catch (error) {
    console.error('❌ Fehler beim Löschen des Dokuments:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Dokuments' });
  }
});

module.exports = router;