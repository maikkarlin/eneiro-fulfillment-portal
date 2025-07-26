const { getConnection, sql } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Neuen Portal-User erstellen
  static async create(kKunde, email, password) {
    try {
      const pool = await getConnection();
      const passwordHash = await bcrypt.hash(password, 10);
      
      const result = await pool.request()
        .input('kKunde', sql.Int, kKunde)
        .input('email', sql.NVarChar, email)
        .input('passwordHash', sql.NVarChar, passwordHash)
        .query(`
          INSERT INTO tPortalUsers (kKunde, cEmail, cPasswordHash)
          VALUES (@kKunde, @email, @passwordHash);
          SELECT SCOPE_IDENTITY() as id;
        `);
      
      return result.recordset[0].id;
    } catch (error) {
      throw error;
    }
  }

  // User mit Kundendaten abrufen - KORRIGIERT
  static async findByEmail(email) {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`
          SELECT 
            pu.kPortalUser,
            pu.kKunde,
            pu.cEmail,
            pu.cPasswordHash,
            pu.nAktiv,
            k.cKundenNr,
            a.cFirma,
            a.cVorname,
            a.cName,
            a.cStrasse,
            a.cPLZ,
            a.cOrt
          FROM tPortalUsers pu
          INNER JOIN tKunde k ON pu.kKunde = k.kKunde
          LEFT JOIN tAdresse a ON k.kKunde = a.kKunde 
            AND (a.nStandard = 1 OR a.kAdresse = (SELECT MIN(kAdresse) FROM tAdresse WHERE kKunde = k.kKunde))
          WHERE pu.cEmail = @email AND pu.nAktiv = 1
        `);
      
      return result.recordset[0];
    } catch (error) {
      throw error;
    }
  }

  // Prüfe ob Kunde bereits registriert ist
  static async isCustomerRegistered(kKunde) {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('kKunde', sql.Int, kKunde)
        .query(`
          SELECT COUNT(*) as count 
          FROM tPortalUsers 
          WHERE kKunde = @kKunde
        `);
      
      return result.recordset[0].count > 0;
    } catch (error) {
      throw error;
    }
  }

  // Update letzter Login
  static async updateLastLogin(kPortalUser) {
    try {
      const pool = await getConnection();
      await pool.request()
        .input('kPortalUser', sql.Int, kPortalUser)
        .query(`
          UPDATE tPortalUsers 
          SET dLetzterLogin = GETDATE() 
          WHERE kPortalUser = @kPortalUser
        `);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;