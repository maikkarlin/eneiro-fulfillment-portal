const { getConnection, sql } = require('../config/database');

class Customer {
  // Kunde per Kundennummer finden
  static async findByCustomerNumber(customerNumber) {
    try {
      const pool = await getConnection();
      
      // Debug-Query um zu sehen was zurückkommt
      console.log('Suche Kunde mit Nummer:', customerNumber);
      
      const result = await pool.request()
        .input('customerNumber', sql.NVarChar, customerNumber)
        .query(`
          SELECT TOP 1
            k.kKunde,
            k.cKundenNr,
            a.cFirma,
            a.cVorname,
            a.cName,
            a.cMail,
            a.cTel,
            a.cStrasse,
            a.cPLZ,
            a.cOrt,
            a.cLand
          FROM tKunde k
          INNER JOIN tAdresse a ON k.kKunde = a.kKunde 
          WHERE k.cKundenNr = @customerNumber
          ORDER BY a.nStandard DESC, a.kAdresse
        `);
      
      console.log('SQL Ergebnis:', result.recordset);
      
      return result.recordset[0];
    } catch (error) {
      console.error('SQL Fehler:', error);
      throw error;
    }
  }

  // Alle E-Mail-Adressen eines Kunden abrufen
  static async getCustomerEmails(kKunde) {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('kKunde', sql.Int, kKunde)
        .query(`
          SELECT DISTINCT cMail as email
          FROM tAdresse
          WHERE kKunde = @kKunde 
            AND cMail IS NOT NULL 
            AND cMail != ''
            AND cMail NOT LIKE '%marketplace.amazon%'
        `);
      
      return result.recordset.map(r => r.email);
    } catch (error) {
      console.error('Email Query Fehler:', error);
      throw error;
    }
  }
}

module.exports = Customer;