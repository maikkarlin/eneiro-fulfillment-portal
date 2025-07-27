// backend/models/Employee.js - VERSION MIT TEST-BYPASS
const { getConnection, sql } = require('../config/database');
const crypto = require('crypto');

class Employee {
  
  // JTL Benutzer authentifizieren
  static async findByLogin(login) {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('login', sql.NVarChar, login)
        .query(`
          SELECT 
            kBenutzer,
            cLogin,
            cPasswort,
            cName,
            cEMail,
            cAbteilung,
            nAktiv,
            iSalt
          FROM dbo.tBenutzer 
          WHERE cLogin = @login AND nAktiv = 1
        `);
      
      return result.recordset[0];
    } catch (error) {
      throw error;
    }
  }

  // JTL Passwort-Hash prüfen - MIT TEST-BYPASS
  static verifyJTLPassword(inputPassword, storedHash, salt) {
    try {
      console.log('=== JTL Password Debug ===');
      console.log('Input Password Length:', inputPassword.length);
      console.log('Stored Hash:', storedHash);
      console.log('Salt:', salt);
      
      // TEMPORÄRER TEST-BYPASS
      // TODO: Entfernen wenn echtes JTL-Hashing implementiert ist
      if (inputPassword === 'test123' || inputPassword === 'admin') {
        console.log('🔓 TEST-BYPASS: Login erlaubt für Test-Passwort');
        return true;
      }
      
      // Verschiedene JTL Hash-Varianten testen
      const variations = [
        // 1. Standard: Passwort + Salt
        inputPassword + salt,
        // 2. Salt + Passwort
        salt + inputPassword,
        // 3. Nur Passwort (falls Salt ignoriert wird)
        inputPassword,
        // 4. Salt in Großbuchstaben
        inputPassword + salt.toUpperCase(),
        // 5. Salt in Kleinbuchstaben  
        inputPassword + salt.toLowerCase(),
        // 6. Ohne Bindestriche im Salt
        inputPassword + salt.replace(/-/g, ''),
        // 7. Salt ohne Bindestriche + Großbuchstaben
        inputPassword + salt.replace(/-/g, '').toUpperCase(),
        // 8. Salt ohne Bindestriche + Kleinbuchstaben
        inputPassword + salt.replace(/-/g, '').toLowerCase()
      ];

      for (let i = 0; i < variations.length; i++) {
        const hashInput = variations[i];
        const hash = crypto.createHash('sha1').update(hashInput).digest('hex');
        
        console.log(`Variation ${i + 1}: -> ${hash.toUpperCase()}`);
        
        if (hash.toUpperCase() === storedHash.toUpperCase()) {
          console.log(`✅ Password match! (Variation ${i + 1})`);
          return true;
        }
      }
      
      // Zusätzlich: MD5 testen
      console.log('\n=== Testing MD5 ===');
      for (let i = 0; i < Math.min(3, variations.length); i++) {
        const hashInput = variations[i];
        const hash = crypto.createHash('md5').update(hashInput).digest('hex');
        
        console.log(`MD5 Variation ${i + 1}: -> ${hash.toUpperCase()}`);
        
        if (hash.toUpperCase() === storedHash.toUpperCase()) {
          console.log(`✅ Password match with MD5! (Variation ${i + 1})`);
          return true;
        }
      }
      
      console.log('❌ No password match found');
      return false;
      
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // Alle aktiven Mitarbeiter
  static async getAllActive() {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .query(`
          SELECT 
            kBenutzer,
            cLogin,
            cName,
            cEMail,
            cAbteilung
          FROM dbo.tBenutzer 
          WHERE nAktiv = 1
          ORDER BY cName
        `);
      
      return result.recordset;
    } catch (error) {
      throw error;
    }
  }

  // Letzten Login aktualisieren
  static async updateLastLogin(kBenutzer) {
    try {
      const pool = await getConnection();
      await pool.request()
        .input('kBenutzer', sql.Int, kBenutzer)
        .query(`
          UPDATE dbo.tBenutzer 
          SET dLastLogin = GETDATE() 
          WHERE kBenutzer = @kBenutzer
        `);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Employee;