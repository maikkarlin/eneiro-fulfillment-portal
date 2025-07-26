const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

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
const dashboardRoutes = require('./routes/dashboard');  // NEU

// Express App erstellen
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);  // NEU

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

// Server starten
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
  console.log(`📋 Teste die API unter: http://localhost:${PORT}/api/health`);
});