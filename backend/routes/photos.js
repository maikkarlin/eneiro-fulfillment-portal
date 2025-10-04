// backend/routes/photos.js - NEUE DATEI für Multi-Photo Support
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Multer für Multi-Photo Upload
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
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder sind erlaubt'));
    }
  }
});

// Foto-Komprimierung
async function compressImage(inputPath, outputPath) {
  try {
    const tempPath = outputPath + '.tmp';
    
    await sharp(inputPath)
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toFile(tempPath);
    
    fs.unlinkSync(inputPath);
    fs.renameSync(tempPath, outputPath);
    
    console.log('✅ Bild komprimiert:', outputPath);
    return true;
  } catch (error) {
    console.error('❌ Fehler bei Komprimierung:', error);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (e) {}
    return false;
  }
}

// ===== FOTOS FÜR EINE WARENANNAHME ABRUFEN =====
router.get('/warenannahme/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📷 Lade Fotos für Warenannahme:', kWarenannahme);

    const pool = await getConnection();
    
    // Prüfe Zugriffsberechtigung
    const warenannahmeCheck = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query(`
        SELECT w.kWarenannahme, w.kKunde, k.cKundenNr
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        WHERE w.kWarenannahme = @kWarenannahme
      `);

    if (warenannahmeCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden' });
    }

    // Wenn Kunde: Nur eigene sehen
    if (req.user.role === 'customer') {
      if (warenannahmeCheck.recordset[0].cKundenNr !== req.user.customerNumber) {
        return res.status(403).json({ error: 'Kein Zugriff auf diese Warenannahme' });
      }
    }

    // Fotos laden
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query(`
        SELECT 
          kFoto,
          kWarenannahme,
          cDateiPfad,
          cDateiName,
          nDateiGroesse,
          nReihenfolge,
          cBeschreibung,
          bIstHauptfoto,
          dErstellt,
          kBenutzer
        FROM tWarenannahmeFoto
        WHERE kWarenannahme = @kWarenannahme
        ORDER BY bIstHauptfoto DESC, nReihenfolge ASC, dErstellt ASC
      `);

    console.log(`✅ ${result.recordset.length} Fotos gefunden`);
    res.json(result.recordset);

  } catch (error) {
    console.error('❌ Fehler beim Laden der Fotos:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Fotos' });
  }
});

// ===== MEHRERE FOTOS HOCHLADEN =====
router.post('/warenannahme/:id/upload', authenticateToken, upload.array('photos', 10), async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Fotos hochladen' });
    }

    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    const { beschreibung, hauptfoto } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Fotos hochgeladen' });
    }

    console.log(`📷 Lade ${req.files.length} Foto(s) hoch für Warenannahme ${kWarenannahme}`);

    const pool = await getConnection();

    // Prüfe ob Warenannahme existiert
    const warenannahmeCheck = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query('SELECT kWarenannahme FROM tWarenannahme WHERE kWarenannahme = @kWarenannahme');

    if (warenannahmeCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden' });
    }

    // Höchste Reihenfolge ermitteln
    const maxOrder = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query('SELECT ISNULL(MAX(nReihenfolge), 0) as maxOrder FROM tWarenannahmeFoto WHERE kWarenannahme = @kWarenannahme');

    let currentOrder = maxOrder.recordset[0].maxOrder + 1;
    const uploadedPhotos = [];

    // Fotos verarbeiten und speichern
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      console.log(`📸 Original Größe (${i+1}/${req.files.length}):`, (file.size / 1024 / 1024).toFixed(2), 'MB');

      // Komprimieren
      const compressedFilename = file.filename.replace(/\.(png|jpeg|jpg|gif|heic|heif)$/i, '.jpg');
      const compressedPath = path.join('uploads', 'warenannahme', compressedFilename);
      
      const compressed = await compressImage(file.path, compressedPath);
      const finalFilename = compressed ? compressedFilename : file.filename;
      const finalPath = compressed ? compressedPath : file.path;

      // Dateigröße
      const stats = fs.statSync(finalPath);
      console.log(`✅ Finale Größe (${i+1}/${req.files.length}):`, (stats.size / 1024 / 1024).toFixed(2), 'MB');

      // In Datenbank speichern
      const isHauptfoto = (i === 0 && hauptfoto === 'true') || req.files.length === 1;
      
      const result = await pool.request()
        .input('kWarenannahme', sql.Int, kWarenannahme)
        .input('cDateiPfad', sql.NVarChar, finalFilename)
        .input('cDateiName', sql.NVarChar, file.originalname)
        .input('nDateiGroesse', sql.BigInt, stats.size)
        .input('nReihenfolge', sql.Int, currentOrder + i)
        .input('cBeschreibung', sql.NVarChar, beschreibung || null)
        .input('bIstHauptfoto', sql.Bit, isHauptfoto)
        .input('kBenutzer', sql.Int, req.user.id)
        .query(`
          INSERT INTO tWarenannahmeFoto (
            kWarenannahme, cDateiPfad, cDateiName, nDateiGroesse,
            nReihenfolge, cBeschreibung, bIstHauptfoto, kBenutzer, dErstellt
          )
          OUTPUT INSERTED.*
          VALUES (
            @kWarenannahme, @cDateiPfad, @cDateiName, @nDateiGroesse,
            @nReihenfolge, @cBeschreibung, @bIstHauptfoto, @kBenutzer, GETDATE()
          )
        `);

      uploadedPhotos.push(result.recordset[0]);
    }

    console.log(`✅ ${uploadedPhotos.length} Foto(s) erfolgreich hochgeladen`);

    res.status(201).json({
      message: `${uploadedPhotos.length} Foto(s) erfolgreich hochgeladen`,
      photos: uploadedPhotos
    });

  } catch (error) {
    console.error('❌ Fehler beim Hochladen der Fotos:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen: ' + error.message });
  }
});

// ===== EINZELNES FOTO LÖSCHEN =====
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Fotos löschen' });
    }

    const { id } = req.params;
    const kFoto = parseInt(id);

    console.log('🗑️ Lösche Foto:', kFoto);

    const pool = await getConnection();

    // Hole Foto-Info
    const photoResult = await pool.request()
      .input('kFoto', sql.Int, kFoto)
      .query('SELECT kFoto, cDateiPfad FROM tWarenannahmeFoto WHERE kFoto = @kFoto');

    if (photoResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Foto nicht gefunden' });
    }

    const photo = photoResult.recordset[0];

    // Datei löschen
    const filePath = path.join('uploads', 'warenannahme', photo.cDateiPfad);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Datei gelöscht:', filePath);
    }

    // DB-Eintrag löschen
    await pool.request()
      .input('kFoto', sql.Int, kFoto)
      .query('DELETE FROM tWarenannahmeFoto WHERE kFoto = @kFoto');

    console.log('✅ Foto erfolgreich gelöscht');
    res.json({ message: 'Foto erfolgreich gelöscht' });

  } catch (error) {
    console.error('❌ Fehler beim Löschen des Fotos:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ===== HAUPTFOTO FESTLEGEN =====
router.patch('/:id/set-main', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter' });
    }

    const { id } = req.params;
    const kFoto = parseInt(id);

    console.log('⭐ Setze Hauptfoto:', kFoto);

    const pool = await getConnection();

    // Hole Warenannahme-ID
    const photoResult = await pool.request()
      .input('kFoto', sql.Int, kFoto)
      .query('SELECT kWarenannahme FROM tWarenannahmeFoto WHERE kFoto = @kFoto');

    if (photoResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Foto nicht gefunden' });
    }

    const kWarenannahme = photoResult.recordset[0].kWarenannahme;

    // Alle Fotos dieser Warenannahme auf nicht-Hauptfoto setzen
    await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query('UPDATE tWarenannahmeFoto SET bIstHauptfoto = 0 WHERE kWarenannahme = @kWarenannahme');

    // Dieses Foto als Hauptfoto setzen
    await pool.request()
      .input('kFoto', sql.Int, kFoto)
      .query('UPDATE tWarenannahmeFoto SET bIstHauptfoto = 1 WHERE kFoto = @kFoto');

    console.log('✅ Hauptfoto gesetzt');
    res.json({ message: 'Hauptfoto erfolgreich gesetzt' });

  } catch (error) {
    console.error('❌ Fehler beim Setzen des Hauptfotos:', error);
    res.status(500).json({ error: 'Fehler beim Setzen des Hauptfotos' });
  }
});

module.exports = router;