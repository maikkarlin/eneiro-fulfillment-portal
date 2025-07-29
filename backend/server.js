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
// In backend/server.js - Ersetze diese Zeile:
// app.use(cors());

// Mit dieser erweiterten CORS-Konfiguration:
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Zusätzlich: Explizite OPTIONS-Handler für Preflight Requests
app.options('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Statische Dateien für Uploads (NEU)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes); // NEU
app.use('/api/customers', require('./routes/customers')); // NEU
app.use('/api/blocklager', require('./routes/blocklager'));

console.log('🔧 Teste Route-Registrierung...');

// Test ob die Datei geladen werden kann
try {
  const blocklagerRoute = require('./routes/blocklager');
  console.log('✅ Blocklager-Route-Datei erfolgreich geladen');
  console.log('✅ Route-Objekt:', typeof blocklagerRoute);
} catch (error) {
  console.error('❌ Fehler beim Laden der Blocklager-Route:', error);
}

// 3. Oder teste mit einer einfachen Test-Route:
app.get('/api/blocklager/test', (req, res) => {
  res.json({ message: 'Blocklager Route funktioniert!' });
});
console.log('🧪 Test-Route registriert: /api/blocklager/test');

// 4. Debug: Zeige alle registrierten Routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  // Durchsuche alle Middleware
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Direkte Route
      routes.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router') {
      // Router Middleware (unsere API Routes)
      const routerName = middleware.regexp.toString();
      
      if (middleware.handle && middleware.handle.stack) {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              method: Object.keys(handler.route.methods)[0].toUpperCase(),
              path: handler.route.path,
              router: routerName
            });
          }
        });
      }
    }
  });
  
  res.json({ 
    message: 'Alle registrierten Routes',
    routes: routes,
    totalRoutes: routes.length
  });
});
console.log('🔍 Debug-Route verfügbar: /api/debug/routes');

// Routes mit Logging
console.log('🔧 Registriere Routes...');

app.use('/api/auth', authRoutes);
console.log('✅ Auth Route registriert');

app.use('/api/dashboard', dashboardRoutes);
console.log('✅ Dashboard Route registriert');

app.use('/api/goods-receipt', goodsReceiptRoutes);
console.log('✅ Goods Receipt Route registriert');

app.use('/api/customers', require('./routes/customers'));
console.log('✅ Customers Route registriert');

try {
  app.use('/api/blocklager', require('./routes/blocklager'));
  console.log('✅ Blocklager Route erfolgreich registriert');
} catch (error) {
  console.error('❌ Fehler beim Registrieren der Blocklager Route:', error);
}

console.log('🚀 Alle Routes registriert');

// Zusätzlich: Route testen
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const path = middleware.regexp.toString().includes('^\\/?') 
            ? middleware.regexp.toString().match(/\^\\?\?\(\.\*\)/)?.[0] || ''
            : '';
          routes.push({
            method: Object.keys(handler.route.methods)[0].toUpperCase(),
            path: path + handler.route.path
          });
        }
      });
    }
  });
  res.json({ registeredRoutes: routes });
});

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