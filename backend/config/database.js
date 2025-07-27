const sql = require('mssql');

// Debug: Zeige die geladenen Umgebungsvariablen
console.log('🔍 Umgebungsvariablen:');
console.log('DB_SERVER:', process.env.DB_SERVER);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PORT:', process.env.DB_PORT);

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false, // Für lokale Verbindung
    trustServerCertificate: true,
    enableArithAbort: true
  },
  requestTimeout: 60000, // 60 Sekunden für komplexe Queries
  connectionTimeout: 30000 // 30 Sekunden für Verbindungsaufbau
};

let pool;

async function getConnection() {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log('✅ Datenbankverbindung hergestellt');
    }
    return pool;
  } catch (err) {
    console.error('❌ Datenbankverbindung fehlgeschlagen:', err.message);
    throw err;
  }
}

async function testConnection() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ Datenbank-Test erfolgreich:', result.recordset);
    return true;
  } catch (err) {
    console.error('❌ Datenbank-Test fehlgeschlagen:', err);
    return false;
  }
}

// Hilfsfunktion um den korrekten Datenbanknamen zu ermitteln
function getDatabaseName() {
  return process.env.DB_DATABASE || 'eazybusiness';
}

module.exports = { getConnection, sql, testConnection, getDatabaseName };