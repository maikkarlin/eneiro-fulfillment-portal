// backend/routes/customers.js - MIT FULFILLMENT FILTER
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Alle aktiven Fulfillment-Kunden abrufen (nur kLabel = 2)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('👥 Lade Fulfillment-Kunden (kLabel = 2)...');
    
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        k.kKunde,
        k.cKundenNr,
        a.cFirma,
        a.cVorname,
        a.cName
      FROM tKunde k
      LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
      LEFT JOIN tKundeLabel kl ON k.kKunde = kl.kKunde
      WHERE kl.kLabel = 2
      ORDER BY a.cFirma
    `);
    
    console.log(`✅ ${result.recordset.length} Fulfillment-Kunden gefunden`);
    res.json(result.recordset);
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Fulfillment-Kunden:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Fulfillment-Kunden' });
  }
});

module.exports = router;