// backend/routes/blocklager.js
const express = require('express');
const sql = require('mssql');
const router = express.Router();
const { getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// 🔍 Artikelsuche (nach Artikelnummer ODER Barcode)
router.get('/artikel/search', authenticateToken, async (req, res) => {
  const suchwert = req.query.q?.trim();
  
  if (!suchwert) {
    return res.status(400).json({ error: 'Suchbegriff erforderlich' });
  }

  try {
    console.log('🔍 Artikelsuche für:', suchwert);
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('suchwert', sql.NVarChar, suchwert)
      .query(`
        SELECT 
          a.cArtNr,
          ab.cName,
          a.cBarcode,
          MAX(CASE WHEN taa.kAttribut = 1513 THEN tas.nWertInt END) AS anzahlArtikelProPalette,
          MAX(CASE WHEN taa.kAttribut = 1514 THEN tas.nWertInt END) AS anzahlMasterkartonsProPalette,
          MAX(CASE WHEN taa.kAttribut = 1515 THEN tas.nWertInt END) AS anzahlStueckProMasterkarton
        FROM dbo.tArtikel a
        LEFT JOIN dbo.tArtikelBeschreibung ab ON ab.kArtikel = a.kArtikel
        LEFT JOIN dbo.tArtikelAttribut taa ON taa.kArtikel = a.kArtikel 
        LEFT JOIN dbo.tArtikelAttributSprache tas ON tas.kArtikelAttribut = taa.kArtikelAttribut
        WHERE (a.cArtNr = @suchwert OR a.cBarcode = @suchwert)
          AND ab.kSprache = 1
        GROUP BY a.cArtNr, ab.cName, a.cBarcode
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    
    console.log('✅ Artikel gefunden:', result.recordset[0]);
    res.json(result.recordset[0]);
    
  } catch (err) {
    console.error('❌ Fehler bei der Artikelsuche:', err);
    res.status(500).json({ error: 'Fehler bei der Artikelsuche' });
  }
});

// 🔧 Artikelfelder speichern (nur die drei Blocklager-Felder)
router.post('/artikel/update', authenticateToken, async (req, res) => {
  const {
    artnr,
    anzahlPalette,
    anzahlMasterkartons,
    anzahlStueckProMasterkarton,
  } = req.body;

  if (!artnr) {
    return res.status(400).json({ error: 'Artikelnummer erforderlich' });
  }

  try {
    console.log(`🟢 Speichervorgang für Artikel: ${artnr}`);
    
    const pool = await getConnection();
    
    // Artikel prüfen und kArtikel ermitteln
    const artikelResult = await pool.request()
      .input('artnr', sql.NVarChar, artnr)
      .query(`
        SELECT kArtikel FROM dbo.tArtikel WHERE cArtNr = @artnr
      `);

    if (artikelResult.recordset.length === 0) {
      console.log('⚠️ Artikel nicht gefunden');
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    const kArtikel = artikelResult.recordset[0].kArtikel;
    console.log(`🔑 kArtikel: ${kArtikel}`);

    // Funktion zum Insert/Update der Attribute
async function upsertCustomField(kAttribut, wert) {
  const checkResult = await pool.request()
    .input('kArtikel', sql.Int, kArtikel)
    .input('kAttribut', sql.Int, kAttribut)
    .query(`
      SELECT taa.kArtikelAttribut
      FROM dbo.tArtikelAttribut taa
      WHERE taa.kArtikel = @kArtikel AND taa.kAttribut = @kAttribut
    `);

  if (checkResult.recordset.length > 0) {
    // Update bestehender Wert
    const kAA = checkResult.recordset[0].kArtikelAttribut;
    console.log(`Update Attribut ${kAttribut}: Wert = ${wert}`);

    await pool.request()
      .input('wert', sql.Int, parseInt(wert) || 0)
      .input('kArtikelAttribut', sql.Int, kAA)
      .query(`
        UPDATE dbo.tArtikelAttributSprache
        SET nWertInt = @wert
        WHERE kArtikelAttribut = @kArtikelAttribut AND kSprache = 0
      `);
    
    console.log(`✅ Attribut ${kAttribut} aktualisiert`);
  } else {
    // Neuen Wert einfügen - OHNE OUTPUT wegen Trigger
    console.log(`Insert Attribut ${kAttribut}: Wert = ${wert}`);
    
    // Schritt 1: INSERT ohne OUTPUT
    await pool.request()
      .input('kArtikel', sql.Int, kArtikel)
      .input('kAttribut', sql.Int, kAttribut)
      .query(`
        INSERT INTO dbo.tArtikelAttribut (kArtikel, kAttribut, kShop)
        VALUES (@kArtikel, @kAttribut, 0)
      `);
    
    // Schritt 2: Die neue kArtikelAttribut ermitteln
    const newIdResult = await pool.request()
      .input('kArtikel', sql.Int, kArtikel)
      .input('kAttribut', sql.Int, kAttribut)
      .query(`
        SELECT kArtikelAttribut 
        FROM dbo.tArtikelAttribut 
        WHERE kArtikel = @kArtikel AND kAttribut = @kAttribut
      `);
    
    if (newIdResult.recordset.length === 0) {
      throw new Error(`❌ Konnte kArtikelAttribut nicht finden nach Insert für Attribut ${kAttribut}`);
    }
    
    const newKAA = newIdResult.recordset[0].kArtikelAttribut;
    console.log(`🆕 Neuer kArtikelAttribut = ${newKAA}`);

    // Schritt 3: Sprachwert einfügen
    await pool.request()
      .input('kArtikelAttribut', sql.Int, newKAA)
      .input('wert', sql.Int, parseInt(wert) || 0)
      .query(`
        INSERT INTO dbo.tArtikelAttributSprache (kArtikelAttribut, kSprache, nWertInt)
        VALUES (@kArtikelAttribut, 0, @wert)
      `);
    
    console.log(`✅ Attribut ${kAttribut} eingefügt`);
  }
}

    // Alle drei Attribute verarbeiten
    await upsertCustomField(1513, anzahlPalette);
    await upsertCustomField(1514, anzahlMasterkartons);
    await upsertCustomField(1515, anzahlStueckProMasterkarton);

    console.log('✅ Alle Blocklager-Werte gespeichert');
    res.json({ 
      success: true, 
      message: 'Blocklager-Daten erfolgreich gespeichert' 
    });
    
  } catch (err) {
    console.error('❌ Fehler beim Speichern:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Blocklager-Daten' });
  }
});

module.exports = router;