// backend/server.js - CORS Konfiguration KORRIGIERT
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');

// Lade Umgebungsvariablen
const result = dotenv.config();
if (result.error) {
  console.error('❌ Fehler beim Laden der .env Datei:', result.error);
} else {
  console.log('✅ .env Datei erfolgreich geladen');
}

// Module laden
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const goodsReceiptRoutes = require('./routes/goodsReceipt');

// Express App erstellen
const app = express();
const PORT = process.env.PORT || 5000;

// CORS Konfiguration - ERWEITERT für Production
const corsOptions = {
  origin: function (origin, callback) {
    // Erlaubte Origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://portal.infra-gw.io',
      'http://portal.infra-gw.io',
      // Falls Sie eine andere Domain verwenden:
      // 'https://ihre-domain.com'
    ];
    
    // In Development: Auch undefined erlauben (für Postman, etc.)
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

// Explizite OPTIONS-Handler
app.options('*', cors(corsOptions));

// Body Parser
app.use(express.json());

// Statische Dateien für Uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes);
app.use('/api/customers', require('./routes/customers'));
app.use('/api/blocklager', require('./routes/blocklager'));

// Debug Route für CORS
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    message: 'CORS funktioniert!',
    origin: req.get('Origin'),
    timestamp: new Date()
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server läuft!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Datenbank-Test Route
app.get('/api/test-db', async (req, res) => {
  try {
    const success = await testConnection();
    if (success) {
      res.json({ status: 'OK', message: 'Datenbankverbindung erfolgreich!' });
    } else {
      res.status(500).json({ status: 'ERROR', message: 'Datenbankverbindung fehlgeschlagen' });
    }
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Interner Serverfehler',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Upload-Ordner erstellen
function createUploadDirectories() {
  const uploadDir = 'uploads/warenannahme';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Upload-Ordner erstellt:', uploadDir);
  }
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
      console.log(`🧪 CORS Test: http://localhost:${PORT}/api/cors-test`);
      console.log(`🌐 Umgebung: ${process.env.NODE_ENV || 'development'}`);
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Serverstart:', error);
    process.exit(1);
  }
}

startServer();
