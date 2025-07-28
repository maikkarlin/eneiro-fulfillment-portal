// backend/db.js
const sql = require('mssql');
require('dotenv').config();

// SQL Server Konfiguration
const config = {
  server: process.env.DB_SERVER.replace('\\\\', '\\'),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Connection Pool erstellen
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Verbindung zur SQL Server Datenbank hergestellt');
    return pool;
  })
  .catch(err => {
    console.error('❌ Datenbankverbindung fehlgeschlagen:', err);
    throw err;
  });

// Helper-Funktion für Queries
async function query(queryString, inputs) {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    
    // Input-Parameter hinzufügen wenn vorhanden
    if (inputs) {
      Object.keys(inputs).forEach(key => {
        request.input(key, inputs[key]);
      });
    }
    
    const result = await request.query(queryString);
    return result;
  } catch (err) {
    console.error('Query-Fehler:', err);
    throw err;
  }
}

// Für die goodsReceipt.js Kompatibilität - OHNE Transaction
async function getConnection() {
  const pool = await poolPromise;
  
  return {
    execute: async (query, params = []) => {
      try {
        const request = pool.request();
        
        // Parameter binden
        params.forEach((param, index) => {
          request.input(`param${index}`, param);
        });
        
        // Query mit Parametern ersetzen
        let processedQuery = query;
        params.forEach((param, index) => {
          processedQuery = processedQuery.replace('?', `@param${index}`);
        });
        
        const result = await request.query(processedQuery);
        return [result.recordset];
      } catch (err) {
        console.error('Execute-Fehler:', err);
        throw err;
      }
    },
    
    release: () => {
      // Connection Pool verwaltet das automatisch
      return Promise.resolve();
    }
  };
}

module.exports = {
  sql,
  poolPromise,
  query,
  getConnection
};