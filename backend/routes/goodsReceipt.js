// backend/routes/goodsReceipt.js
const express = require('express');
const router = express.Router();
const GoodsReceipt = require('../models/GoodsReceipt');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Multer für Foto-Upload konfigurieren
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/warenannahme/') // Stelle sicher, dass dieser Ordner existiert
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'warenannahme-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  },
  fileFilter: function (req, file, cb) {
    // Nur Bilder erlauben
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
});

// === WARENANNAHME ROUTES ===

// === TEST-ROUTE OHNE AUTHENTIFIZIERUNG ===
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Test-Route für Warenannahme aufgerufen');
    
    const goodsReceipts = await GoodsReceipt.getAll();
    
    res.json({
      message: 'Warenannahme API funktioniert!',
      count: goodsReceipts.length,
      data: goodsReceipts
    });
    
  } catch (error) {
    console.error('❌ Fehler in Test-Route:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Test-Daten' });
  }
});

// Alle Warenannahmen abrufen
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Lade alle Warenannahmen...');
    
    // Filter aus Query-Parametern
    const filters = {};
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.kKunde) filters.kKunde = parseInt(req.query.kKunde);
    
    const goodsReceipts = await GoodsReceipt.getAll(filters);
    
    console.log(`✅ ${goodsReceipts.length} Warenannahmen gefunden`);
    res.json(goodsReceipts);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahmen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahmen' });
  }
});

// Einzelne Warenannahme abrufen
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const kWarenannahme = parseInt(req.params.id);
    console.log('📦 Lade Warenannahme:', kWarenannahme);
    
    const goodsReceipt = await GoodsReceipt.getById(kWarenannahme);
    
    if (!goodsReceipt) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden' });
    }
    
    res.json(goodsReceipt);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Warenannahme' });
  }
});

// Neue Warenannahme erstellen
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
    
    // Daten vorbereiten
    const goodsReceiptData = {
      dDatum: req.body.dDatum || new Date(),
      tUhrzeit: req.body.tUhrzeit || new Date(),
      kKunde: parseInt(req.body.kKunde),
      cTransporteur: req.body.cTransporteur,
      cPackstueckArt: req.body.cPackstueckArt,
      nAnzahlPackstuecke: parseInt(req.body.nAnzahlPackstuecke),
      cZustand: req.body.cZustand || 'In Ordnung',
      bPalettentausch: req.body.bPalettentausch === 'true' || req.body.bPalettentausch === true,
      cJTLLieferantenbestellnummer: req.body.cJTLLieferantenbestellnummer || null,
      cAnmerkung: req.body.cAnmerkung || null,
      cFotoPath: req.file ? req.file.path : null,
      kBenutzer: req.user.id, // Aus JWT Token
      cStatus: 'Eingegangen'
    };
    
    const kWarenannahme = await GoodsReceipt.create(goodsReceiptData);
    
    console.log('✅ Warenannahme erstellt mit ID:', kWarenannahme);
    
    // Vollständige Warenannahme zurückgeben
    const createdGoodsReceipt = await GoodsReceipt.getById(kWarenannahme);
    
    res.status(201).json({
      message: 'Warenannahme erfolgreich erstellt',
      kWarenannahme: kWarenannahme,
      goodsReceipt: createdGoodsReceipt
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Warenannahme: ' + error.message });
  }
});

// Status einer Warenannahme aktualisieren
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const kWarenannahme = parseInt(req.params.id);
    const { cStatus } = req.body;
    
    console.log(`📦 Aktualisiere Status für Warenannahme ${kWarenannahme} auf: ${cStatus}`);
    
    // Validierung der erlaubten Status
    const allowedStatuses = ['Eingegangen', 'In Einlagerung', 'Eingelagert'];
    if (!allowedStatuses.includes(cStatus)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }
    
    await GoodsReceipt.updateStatus(kWarenannahme, cStatus, req.user.id);
    
    console.log('✅ Status aktualisiert');
    res.json({ message: 'Status erfolgreich aktualisiert' });
    
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren des Status:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
  }
});

// Warenannahme komplett aktualisieren
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const kWarenannahme = parseInt(req.params.id);
    console.log('📦 Aktualisiere Warenannahme:', kWarenannahme);
    
    // Daten vorbereiten (ähnlich wie bei POST)
    const updateData = {
      kKunde: parseInt(req.body.kKunde),
      cTransporteur: req.body.cTransporteur,
      cPackstueckArt: req.body.cPackstueckArt,
      nAnzahlPackstuecke: parseInt(req.body.nAnzahlPackstuecke),
      cZustand: req.body.cZustand,
      bPalettentausch: req.body.bPalettentausch === 'true' || req.body.bPalettentausch === true,
      cJTLLieferantenbestellnummer: req.body.cJTLLieferantenbestellnummer,
      cAnmerkung: req.body.cAnmerkung,
      cStatus: req.body.cStatus
    };
    
    await GoodsReceipt.update(kWarenannahme, updateData);
    
    // Aktualisierte Warenannahme zurückgeben
    const updatedGoodsReceipt = await GoodsReceipt.getById(kWarenannahme);
    
    console.log('✅ Warenannahme aktualisiert');
    res.json({
      message: 'Warenannahme erfolgreich aktualisiert',
      goodsReceipt: updatedGoodsReceipt
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Warenannahme' });
  }
});

// Warenannahme löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const kWarenannahme = parseInt(req.params.id);
    console.log('📦 Lösche Warenannahme:', kWarenannahme);
    
    // Prüfen ob Warenannahme existiert
    const goodsReceipt = await GoodsReceipt.getById(kWarenannahme);
    if (!goodsReceipt) {
      return res.status(404).json({ error: 'Warenannahme nicht gefunden' });
    }
    
    await GoodsReceipt.delete(kWarenannahme);
    
    console.log('✅ Warenannahme gelöscht');
    res.json({ message: 'Warenannahme erfolgreich gelöscht' });
    
  } catch (error) {
    console.error('❌ Fehler beim Löschen der Warenannahme:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Warenannahme' });
  }
});

// === DASHBOARD & STATISTIKEN ===

// Warenannahme-Statistiken für Dashboard
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Lade Warenannahme-Statistiken...');
    
    const stats = await GoodsReceipt.getStats();
    
    console.log('✅ Statistiken geladen:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

module.exports = router;