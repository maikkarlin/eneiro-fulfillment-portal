// backend/server.js - KOMPLETTE REPARATUR FÜR FOTOS
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Lade Umgebungsvariablen
const result = dotenv.config();
if (result.error) {
  console.error('❌ Fehler beim Laden der .env Datei:', result.error);
} else {
  console.log('✅ .env Datei erfolgreich geladen');
}

// Module laden
const { testConnection } = require('./config/database');

// Express App erstellen
const app = express();
const PORT = process.env.PORT || 5000;

// CORS Konfiguration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://ffn.eneiro.io',
      'http://ffn.eneiro.io',
    ];
    
    if (process.env.NODE_ENV !== 'production' && !origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body Parser
app.use(express.json());

// ===== WICHTIG: FOTOS RICHTIG SERVIEREN =====
// Upload-Ordner als statische Dateien bereitstellen
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // CORS Headers für Bilder setzen
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

// Debug Middleware
app.use((req, res, next) => {
  if (req.path.includes('/uploads/') || req.path.includes('/api/')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Routes laden und registrieren
try {
  const authRoutes = require('./routes/auth');
  const dashboardRoutes = require('./routes/dashboard');
  const goodsReceiptRoutes = require('./routes/goodsReceipt');
  const customersRoutes = require('./routes/customers');
  const blocklagerRoutes = require('./routes/blocklager');

  // Routes registrieren
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/goods-receipt', goodsReceiptRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/blocklager', blocklagerRoutes);
  
  console.log('✅ Alle Routes erfolgreich registriert');
} catch (error) {
  console.error('❌ Fehler beim Laden der Routes:', error);
}

// Debug Route für Upload-Dateien
app.get('/api/uploads/test', (req, res) => {
  const uploadDir = path.join(__dirname, 'uploads');
  const warenannahmeDir = path.join(uploadDir, 'warenannahme');
  
  try {
    const files = fs.existsSync(warenannahmeDir) 
      ? fs.readdirSync(warenannahmeDir) 
      : [];
    
    res.json({
      message: 'Upload-Verzeichnis Status',
      uploadDir: uploadDir,
      warenannahmeDir: warenannahmeDir,
      exists: fs.existsSync(warenannahmeDir),
      files: files,
      totalFiles: files.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Fehler beim Lesen des Upload-Verzeichnisses',
      details: error.message
    });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  const uploadDir = path.join(__dirname, 'uploads');
  const warenannahmeDir = path.join(__dirname, 'uploads', 'warenannahme');
  
  res.json({ 
    status: 'OK', 
    message: 'Server läuft!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    uploads: {
      baseDir: uploadDir,
      warenannahmeDir: warenannahmeDir,
      exists: fs.existsSync(warenannahmeDir)
    }
  });
});

// 404 Handler für unbekannte Routes
app.use('/api/*', (req, res) => {
  console.log('❌ 404 - Route nicht gefunden:', req.method, req.path);
  res.status(404).json({ 
    error: 'Route nicht gefunden',
    method: req.method,
    path: req.path
  });
});

// Globaler Error Handler
app.use((error, req, res, next) => {
  console.error('🚨 Globaler Fehler:', error);
  res.status(500).json({ 
    error: 'Serverfehler', 
    message: error.message
  });
});

// Upload-Ordner erstellen
function createUploadDirectories() {
  const directories = [
    'uploads',
    'uploads/warenannahme'
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 Upload-Ordner erstellt:', dir);
    } else {
      console.log('✅ Upload-Ordner existiert bereits:', dir);
    }
  });
}

// Server starten
async function startServer() {
  try {
    createUploadDirectories();
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.log('⚠️  Datenbankverbindung fehlgeschlagen, aber Server wird trotzdem gestartet');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server läuft auf http://0.0.0.0:${PORT}`);
      console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📁 Upload Test: http://localhost:${PORT}/api/uploads/test`);
      console.log(`🖼️  Fotos verfügbar unter: http://localhost:${PORT}/uploads/warenannahme/`);
      console.log(`🌐 Umgebung: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Serverstart:', error);
    process.exit(1);
  }
}

startServer();