// backend/routes/goodsReceipt.js - KOMPLETT MIT MULTI-PHOTO SUPPORT UND ZEIT-FIX
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
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
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Nur Bilder sind erlaubt (JPEG, JPG, PNG, GIF, HEIC)'));
    }
  }
});

// Bild-Komprimierungs-Funktion
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

// Stats Endpoint
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Lade Warenannahme-Statistiken...');
    
    const pool = await getConnection();
    const today = new Date().toISOString().split('T')[0];
    
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

// Alle Warenannahmen für Mitarbeiter
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
          CONVERT(VARCHAR(8), w.tUhrzeit, 108) AS tUhrzeit,
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
    
    // Zeit in allen Einträgen auf HH:MM kürzen
    result.recordset.forEach(record => {
      if (record.tUhrzeit && record.tUhrzeit.length > 5) {
        record.tUhrzeit = record.tUhrzeit.substring(0, 5);
      }
    });
    
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

// Warenannahmen für Kunden
router.get('/customer', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Nur für Kunden' });
    }

    console.log('📦 Lade Warenannahmen für Kunde:', req.user.customerNumber);

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

    const warenannahmenResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          CONVERT(VARCHAR(8), w.tUhrzeit, 108) AS tUhrzeit,
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

    // Zeit in allen Einträgen auf HH:MM kürzen
    warenannahmenResult.recordset.forEach(record => {
      if (record.tUhrzeit && record.tUhrzeit.length > 5) {
        record.tUhrzeit = record.tUhrzeit.substring(0, 5);
      }
    });

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

// Einzelne Warenannahme für Mitarbeiter
router.get('/:id', authenticateToken, async (req, res) => {
  try {
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
          CONVERT(VARCHAR(8), w.tUhrzeit, 108) AS tUhrzeit,
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
    
    // Zeit auf HH:MM kürzen falls Sekunden vorhanden
    const record = result.recordset[0];
    if (record.tUhrzeit && record.tUhrzeit.length > 5) {
      record.tUhrzeit = record.tUhrzeit.substring(0, 5);
    }
    
    console.log('✅ Warenannahme Details geladen für Mitarbeiter, Zeit:', record.tUhrzeit);
    res.json(record);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Einzelne Warenannahme für Kunden
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
          CONVERT(VARCHAR(8), w.tUhrzeit, 108) AS tUhrzeit,
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
    
    // Zeit auf HH:MM kürzen falls Sekunden vorhanden
    const record = result.recordset[0];
    if (record.tUhrzeit && record.tUhrzeit.length > 5) {
      record.tUhrzeit = record.tUhrzeit.substring(0, 5);
    }
    
    console.log('✅ Warenannahme Details geladen für Kunde, Zeit:', record.tUhrzeit);
    res.json(record);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Kundenwarenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Warenannahme erstellen MIT MULTI-PHOTO SUPPORT
router.post('/', authenticateToken, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'additionalPhotos', maxCount: 10 }
]), async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ error: 'Nur Mitarbeiter können Warenannahmen erstellen' });
    }

    console.log('📦 Erstelle neue Warenannahme...');
    console.log('Body:', req.body);
    console.log('Files:', req.files);

    const {
      kKunde,
      cTransporteur,
      cPackstueckArt,
      nAnzahlPackstuecke,
      cZustand,
      bPalettentausch,
      cJTLLieferantenbestellnummer,
      cAnmerkung,
      dDatum,
      tUhrzeit
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

    // HAUPTFOTO verarbeiten (Abwärtskompatibilität)
    const mainPhoto = req.files?.photo?.[0];
    let fotoPath = null;
    
    if (mainPhoto) {
      console.log('📸 Hauptfoto - Original Größe:', (mainPhoto.size / 1024 / 1024).toFixed(2), 'MB');
      
      const compressedFilename = mainPhoto.filename.replace(/\.(png|jpeg|jpg|gif|heic|heif)$/i, '.jpg');
      const compressedPath = path.join('uploads', 'warenannahme', compressedFilename);
      
      const compressed = await compressImage(mainPhoto.path, compressedPath);
      
      if (compressed) {
        fotoPath = compressedFilename;
        const stats = fs.statSync(compressedPath);
        console.log('✅ Hauptfoto komprimiert:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
      } else {
        fotoPath = mainPhoto.filename;
      }
    }

    const now = new Date();
    let finalDate, timeStr;
    
    if (dDatum) {
      finalDate = dDatum;
    } else {
      finalDate = now.toISOString().split('T')[0];
    }
    
    if (tUhrzeit) {
      timeStr = tUhrzeit;
      console.log('🕐 Zeit vom Frontend:', tUhrzeit);
    } else {
      const localTime = new Date();
      timeStr = localTime.getHours().toString().padStart(2, '0') + ':' + 
                localTime.getMinutes().toString().padStart(2, '0');
    }

    // WICHTIG: Zeit direkt als String verwenden, KEINE Date-Konvertierung
    console.log('📅 Finale Werte - Datum:', finalDate, 'Zeit:', timeStr);

    // Warenannahme in DB erstellen
    const result = await pool.request()
      .input('dDatum', sql.Date, finalDate)
      .input('tUhrzeit', sql.VarChar(5), timeStr)
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
          @dDatum, CAST(@tUhrzeit AS time), @kKunde, @cTransporteur, @cPackstueckArt,
          @nAnzahlPackstuecke, @cZustand, @bPalettentausch,
          @cJTLLieferantenbestellnummer, @cAnmerkung, @cFotoPath,
          @kBenutzer, @cStatus, GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() as kWarenannahme;
      `);

    const kWarenannahme = result.recordset[0].kWarenannahme;
    console.log('✅ Warenannahme erstellt mit ID:', kWarenannahme);

    // ZUSÄTZLICHE FOTOS verarbeiten und speichern
    const additionalPhotos = req.files?.additionalPhotos || [];
    
    if (additionalPhotos.length > 0) {
      console.log(`📸 Verarbeite ${additionalPhotos.length} zusätzliche Fotos...`);
      
      // Prüfen ob Tabelle tWarenannahmeFoto existiert
      const tableCheck = await pool.request().query(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'tWarenannahmeFoto'
      `);
      
      if (tableCheck.recordset[0].count > 0) {
        // Tabelle existiert - Fotos verarbeiten und speichern
        for (let i = 0; i < additionalPhotos.length; i++) {
          const photo = additionalPhotos[i];
          
          console.log(`📸 Foto ${i+1} - Original Größe:`, (photo.size / 1024 / 1024).toFixed(2), 'MB');
          
          // Komprimieren
          const compressedFilename = photo.filename.replace(/\.(png|jpeg|jpg|gif|heic|heif)$/i, '.jpg');
          const compressedPath = path.join('uploads', 'warenannahme', compressedFilename);
          
          const compressed = await compressImage(photo.path, compressedPath);
          const finalFilename = compressed ? compressedFilename : photo.filename;
          
          if (compressed) {
            const stats = fs.statSync(compressedPath);
            console.log(`✅ Foto ${i+1} komprimiert:`, (stats.size / 1024 / 1024).toFixed(2), 'MB');
          }
          
          // In DB speichern
          const sortOrder = i + 2; // Hauptfoto = 1, weitere ab 2
          
          await pool.request()
            .input('kWarenannahme', sql.Int, kWarenannahme)
            .input('cDateiPfad', sql.VarChar(500), finalFilename)
            .input('cDateiName', sql.VarChar(255), finalFilename)
            .input('bIstHauptfoto', sql.Bit, false)
            .input('nReihenfolge', sql.Int, sortOrder)
            .query(`
              INSERT INTO tWarenannahmeFoto (
                kWarenannahme, cDateiPfad, cDateiName, bIstHauptfoto, nReihenfolge, dErstellt
              ) VALUES (
                @kWarenannahme, @cDateiPfad, @cDateiName, @bIstHauptfoto, @nReihenfolge, GETDATE()
              )
            `);
        }
        
        console.log(`✅ ${additionalPhotos.length} zusätzliche Fotos gespeichert`);
      } else {
        console.warn('⚠️ Tabelle tWarenannahmeFoto existiert nicht - zusätzliche Fotos werden nicht gespeichert');
        console.warn('⚠️ Führe SQL-Migration aus um Multi-Photo Feature zu nutzen');
      }
    }

    const totalPhotos = (mainPhoto ? 1 : 0) + additionalPhotos.length;
    console.log(`✅ Gesamt ${totalPhotos} Foto(s) verarbeitet`);

    res.json({
      message: 'Warenannahme erfolgreich erstellt',
      kWarenannahme,
      fotoPath,
      totalPhotos
    });

  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Warenannahme:', error);
    
    // Bei Fehler: Alle hochgeladenen Dateien löschen
    if (req.files) {
      if (req.files.photo) {
        req.files.photo.forEach(file => {
          const filepath = path.join('uploads', 'warenannahme', file.filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log('🗑️ Gelöscht:', filepath);
          }
        });
      }
      if (req.files.additionalPhotos) {
        req.files.additionalPhotos.forEach(file => {
          const filepath = path.join('uploads', 'warenannahme', file.filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log('🗑️ Gelöscht:', filepath);
          }
        });
      }
    }
    
    // Bessere Fehlermeldungen
    if (error.message.includes('Nur Bilder')) {
      return res.status(400).json({ error: 'Ungültiges Dateiformat. Nur Bilder erlaubt.' });
    }
    if (error.message.includes('File too large')) {
      return res.status(400).json({ error: 'Datei zu groß. Maximum 50MB.' });
    }
    
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

    if (req.file) {
      console.log('📸 Update - Original Größe:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
      
      const compressedFilename = req.file.filename.replace(/\.(png|jpeg|jpg|gif|heic|heif)$/i, '.jpg');
      const compressedPath = path.join('uploads', 'warenannahme', compressedFilename);
      
      const compressed = await compressImage(req.file.path, compressedPath);
      
      const finalFilename = compressed ? compressedFilename : req.file.filename;
      
      updateQuery += `, cFotoPath = @cFotoPath`;
      request.input('cFotoPath', sql.NVarChar, finalFilename);
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

// Status aktualisieren
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

// Alle Fotos einer Warenannahme abrufen
router.get('/:id/photos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const kWarenannahme = parseInt(id);
    
    console.log('📸 Lade alle Fotos für Warenannahme:', kWarenannahme);

    const pool = await getConnection();
    
    // Prüfen ob Tabelle existiert
    const tableCheck = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tWarenannahmeFoto'
    `);
    
    if (tableCheck.recordset[0].count === 0) {
      return res.json([]);
    }

    // Alle Fotos laden
    const result = await pool.request()
      .input('kWarenannahme', sql.Int, kWarenannahme)
      .query(`
        SELECT 
          kFoto,
          kWarenannahme,
          cDateiPfad,
          cDateiName,
          bIstHauptfoto,
          nReihenfolge,
          dErstellt
        FROM tWarenannahmeFoto
        WHERE kWarenannahme = @kWarenannahme
        ORDER BY nReihenfolge, dErstellt
      `);
    
    console.log(`✅ ${result.recordset.length} Fotos geladen`);
    
    res.json(result.recordset);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Fotos:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Fotos' });
  }
});

module.exports = router;