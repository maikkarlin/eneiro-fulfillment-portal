// backend/models/GoodsReceipt.js - DATETIME FIX
const { getConnection, sql } = require('../config/database');

class GoodsReceipt {

  // Neue Warenannahme erstellen
  static async create(data) {
    try {
      const pool = await getConnection();
      
      // Datum und Zeit zu einem DateTime kombinieren
      const dateStr = data.dDatum || new Date().toISOString().split('T')[0];
      const timeStr = data.tUhrzeit || new Date().toTimeString().slice(0, 5);
      const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`);
      
      console.log('📦 Date:', dateStr, 'Time:', timeStr, '-> Combined:', combinedDateTime);
      
      const result = await pool.request()
        .input('dDatum', sql.Date, dateStr)
        .input('dDateTime', sql.DateTime, combinedDateTime) // NEU: Für die Zeit
        .input('kKunde', sql.Int, data.kKunde)
        .input('cTransporteur', sql.NVarChar, data.cTransporteur)
        .input('cPackstueckArt', sql.NVarChar, data.cPackstueckArt)
        .input('nAnzahlPackstuecke', sql.Int, data.nAnzahlPackstuecke)
        .input('cZustand', sql.NVarChar, data.cZustand || 'In Ordnung')
        .input('bPalettentausch', sql.Bit, data.bPalettentausch || false)
        .input('cJTLLieferantenbestellnummer', sql.NVarChar, data.cJTLLieferantenbestellnummer)
        .input('cAnmerkung', sql.NText, data.cAnmerkung)
        .input('cFotoPath', sql.NVarChar, data.cFotoPath)
        .input('kBenutzer', sql.Int, data.kBenutzer)
        .input('cStatus', sql.NVarChar, data.cStatus || 'Eingegangen')
        .query(`
          INSERT INTO tWarenannahme (
            dDatum, tUhrzeit, kKunde, cTransporteur, cPackstueckArt,
            nAnzahlPackstuecke, cZustand, bPalettentausch, 
            cJTLLieferantenbestellnummer, cAnmerkung, cFotoPath,
            kBenutzer, cStatus
          ) VALUES (
            @dDatum, CAST(@dDateTime AS time), @kKunde, @cTransporteur, @cPackstueckArt,
            @nAnzahlPackstuecke, @cZustand, @bPalettentausch,
            @cJTLLieferantenbestellnummer, @cAnmerkung, @cFotoPath,
            @kBenutzer, @cStatus
          );
          SELECT SCOPE_IDENTITY() as kWarenannahme;
        `);
      
      return result.recordset[0].kWarenannahme;
    } catch (error) {
      throw error;
    }
  }

  // Alle Warenannahmen abrufen (mit Kundendaten)
  static async getAll(filters = {}) {
    try {
      const pool = await getConnection();
      
      let whereClause = 'WHERE 1=1';
      const request = pool.request();
      
      // Filter hinzufügen
      if (filters.dateFrom) {
        whereClause += ' AND w.dDatum >= @dateFrom';
        request.input('dateFrom', sql.Date, filters.dateFrom);
      }
      
      if (filters.dateTo) {
        whereClause += ' AND w.dDatum <= @dateTo';
        request.input('dateTo', sql.Date, filters.dateTo);
      }
      
      if (filters.status) {
        whereClause += ' AND w.cStatus = @status';
        request.input('status', sql.NVarChar, filters.status);
      }
      
      if (filters.kKunde) {
        whereClause += ' AND w.kKunde = @kKunde';
        request.input('kKunde', sql.Int, filters.kKunde);
      }

      const result = await request.query(`
        SELECT 
          w.kWarenannahme,
          w.dDatum,
          w.tUhrzeit,
          w.kKunde,
          k.cKundenNr,
          a.cFirma AS KundenFirma,
          w.cTransporteur,
          w.cPackstueckArt,
          w.nAnzahlPackstuecke,
          w.cZustand,
          w.bPalettentausch,
          w.cJTLLieferantenbestellnummer,
          w.cAnmerkung,
          w.cFotoPath,
          w.kBenutzer,
          b.cName AS MitarbeiterName,
          w.cStatus,
          w.dErstellt,
          w.dGeaendert
        FROM tWarenannahme w
        LEFT JOIN tKunde k ON w.kKunde = k.kKunde
        LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
        LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
        ${whereClause}
        ORDER BY w.dDatum DESC, w.tUhrzeit DESC
      `);
      
      return result.recordset;
    } catch (error) {
      throw error;
    }
  }

  // Einzelne Warenannahme abrufen
  static async getById(kWarenannahme) {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('kWarenannahme', sql.Int, kWarenannahme)
        .query(`
          SELECT 
            w.*,
            k.cKundenNr,
            a.cFirma AS KundenFirma,
            b.cName AS MitarbeiterName
          FROM tWarenannahme w
          LEFT JOIN tKunde k ON w.kKunde = k.kKunde
          LEFT JOIN tAdresse a ON k.kKunde = a.kKunde AND a.nStandard = 1
          LEFT JOIN tBenutzer b ON w.kBenutzer = b.kBenutzer
          WHERE w.kWarenannahme = @kWarenannahme
        `);
      
      return result.recordset[0];
    } catch (error) {
      throw error;
    }
  }

  // Status aktualisieren
  static async updateStatus(kWarenannahme, newStatus, kBenutzer) {
    try {
      const pool = await getConnection();
      await pool.request()
        .input('kWarenannahme', sql.Int, kWarenannahme)
        .input('cStatus', sql.NVarChar, newStatus)
        .input('kBenutzer', sql.Int, kBenutzer)
        .query(`
          UPDATE tWarenannahme 
          SET cStatus = @cStatus, 
              dGeaendert = GETDATE()
          WHERE kWarenannahme = @kWarenannahme
        `);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Warenannahme komplett aktualisieren
  static async update(kWarenannahme, data) {
    try {
      const pool = await getConnection();
      
      // DateTime kombinieren
      const dateStr = data.dDatum;
      const timeStr = data.tUhrzeit;
      const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`);
      
      await pool.request()
        .input('kWarenannahme', sql.Int, kWarenannahme)
        .input('dDateTime', sql.DateTime, combinedDateTime)
        .input('kKunde', sql.Int, data.kKunde)
        .input('cTransporteur', sql.NVarChar, data.cTransporteur)
        .input('cPackstueckArt', sql.NVarChar, data.cPackstueckArt)
        .input('nAnzahlPackstuecke', sql.Int, data.nAnzahlPackstuecke)
        .input('cZustand', sql.NVarChar, data.cZustand)
        .input('bPalettentausch', sql.Bit, data.bPalettentausch)
        .input('cJTLLieferantenbestellnummer', sql.NVarChar, data.cJTLLieferantenbestellnummer)
        .input('cAnmerkung', sql.NText, data.cAnmerkung)
        .input('cStatus', sql.NVarChar, data.cStatus)
        .query(`
          UPDATE tWarenannahme 
          SET kKunde = @kKunde,
              tUhrzeit = CAST(@dDateTime AS time),
              cTransporteur = @cTransporteur,
              cPackstueckArt = @cPackstueckArt,
              nAnzahlPackstuecke = @nAnzahlPackstuecke,
              cZustand = @cZustand,
              bPalettentausch = @bPalettentausch,
              cJTLLieferantenbestellnummer = @cJTLLieferantenbestellnummer,
              cAnmerkung = @cAnmerkung,
              cStatus = @cStatus,
              dGeaendert = GETDATE()
          WHERE kWarenannahme = @kWarenannahme
        `);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Warenannahme löschen
  static async delete(kWarenannahme) {
    try {
      const pool = await getConnection();
      await pool.request()
        .input('kWarenannahme', sql.Int, kWarenannahme)
        .query(`
          DELETE FROM tWarenannahme 
          WHERE kWarenannahme = @kWarenannahme
        `);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Statistiken für Dashboard
  static async getStats() {
    try {
      const pool = await getConnection();
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) as GesamtAnlieferungen,
          COUNT(CASE WHEN dDatum = CAST(GETDATE() AS date) THEN 1 END) as HeutigeAnlieferungen,
          COUNT(CASE WHEN cStatus = 'Eingegangen' THEN 1 END) as OffeneEinlagerungen,
          COUNT(CASE WHEN cStatus = 'In Einlagerung' THEN 1 END) as InBearbeitung,
          COUNT(CASE WHEN cStatus = 'Eingelagert' THEN 1 END) as Abgeschlossen,
          SUM(nAnzahlPackstuecke) as GesamtPackstuecke
        FROM tWarenannahme
        WHERE dDatum >= DATEADD(month, -1, GETDATE())
      `);
      
      return result.recordset[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = GoodsReceipt;