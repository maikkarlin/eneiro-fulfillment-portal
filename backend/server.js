const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs'); // NEU für Upload-Ordner

// Lade Umgebungsvariablen
const result = dotenv.config();
if (result.error) {
  console.error('❌ Fehler beim Laden der .env Datei:', result.error);
} else {
  console.log('✅ .env Datei erfolgreich geladen');
}

// Jetzt erst andere Module laden
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const goodsReceiptRoutes = require('./routes/goodsReceipt'); // NEU

// Express App erstellen
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Statische Dateien für Uploads (NEU)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes); // NEU
app.use('/api/customers', require('./routes/customers')); // NEU

// Test-Route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server läuft!',
    timestamp: new Date()
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

// Error Handler (NEU)
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Interner Serverfehler',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler (NEU)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Upload-Ordner erstellen falls nicht vorhanden (NEU)
function createUploadDirectories() {
  const uploadDir = 'uploads/warenannahme';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Upload-Ordner erstellt:', uploadDir);
  } else {
    console.log('📁 Upload-Ordner bereits vorhanden:', uploadDir);
  }
}

// Server starten
async function startServer() {
  try {
    // Upload-Ordner erstellen
    createUploadDirectories();
    
    // Datenbankverbindung testen
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.log('⚠️  Datenbankverbindung fehlgeschlagen, aber Server wird trotzdem gestartet');
    }
    
    app.listen(PORT, () => {
      console.log(`✅ Server läuft auf http://localhost:${PORT}`);
      console.log(`📋 Teste die API unter: http://localhost:${PORT}/api/health`);
      console.log(`📦 Warenannahme API verfügbar unter: http://localhost:${PORT}/api/goods-receipt`);
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Serverstart:', error);
    process.exit(1);
  }
}

startServer();