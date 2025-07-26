const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getConnection, sql } = require('../config/database');

// Dashboard KPIs abrufen
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade KPIs für Kunde:', kKunde);
    
    // Mehrere Queries für verschiedene KPIs
    const kpis = {};
    
    // 1. Bestellungen gesamt (aktueller Monat)
    const totalOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count 
        FROM tBestellung 
        WHERE tKunde_kKunde = @kKunde 
        AND MONTH(dErstellt) = MONTH(GETDATE())
        AND YEAR(dErstellt) = YEAR(GETDATE())
        AND nStorno = 0
      `);
    kpis.totalOrders = totalOrdersResult.recordset[0].count || 0;
    
    // 2. Bestellungen heute
    const todayOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count 
        FROM tBestellung 
        WHERE tKunde_kKunde = @kKunde 
        AND CAST(dErstellt AS DATE) = CAST(GETDATE() AS DATE)
        AND nStorno = 0
      `);
    kpis.ordersToday = todayOrdersResult.recordset[0].count || 0;
    
    // 3. Offene Bestellungen (nicht versendet)
    const pendingOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count 
        FROM tBestellung 
        WHERE tKunde_kKunde = @kKunde 
        AND dVersandt IS NULL
        AND nStorno = 0
        AND dBezahlt IS NOT NULL
      `);
    kpis.pendingShipments = pendingOrdersResult.recordset[0].count || 0;
    
    // 4. Umsatz aktueller Monat (aus Bestellpositionen)
    const revenueResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT ISNULL(SUM(bp.fVKNetto * bp.nAnzahl), 0) as total
        FROM tbestellpos bp
        INNER JOIN tBestellung b ON bp.tBestellung_kBestellung = b.kBestellung
        WHERE b.tKunde_kKunde = @kKunde 
        AND MONTH(b.dErstellt) = MONTH(GETDATE())
        AND YEAR(b.dErstellt) = YEAR(GETDATE())
        AND b.nStorno = 0
      `);
    kpis.revenue = parseFloat(revenueResult.recordset[0].total) || 0;
    
    // 5. Versendete Bestellungen diesen Monat
    const shippedOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count
        FROM tBestellung
        WHERE tKunde_kKunde = @kKunde 
        AND MONTH(dVersandt) = MONTH(GETDATE())
        AND YEAR(dVersandt) = YEAR(GETDATE())
        AND nStorno = 0
      `);
    kpis.packagesShipped = shippedOrdersResult.recordset[0].count || 0;
    
    // 6. Durchschnittliche Bearbeitungszeit (Mock-Daten für jetzt)
    kpis.averageProcessingTime = 1.8;
    kpis.returnRate = 2.3;
    
    // 7. Vergleich zum Vormonat
    const lastMonthOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count 
        FROM tBestellung 
        WHERE tKunde_kKunde = @kKunde 
        AND MONTH(dErstellt) = MONTH(DATEADD(month, -1, GETDATE()))
        AND YEAR(dErstellt) = YEAR(DATEADD(month, -1, GETDATE()))
        AND nStorno = 0
      `);
    const lastMonthOrders = lastMonthOrdersResult.recordset[0].count || 1;
    kpis.ordersTrend = lastMonthOrders > 0 
      ? Math.round(((kpis.totalOrders - lastMonthOrders) / lastMonthOrders) * 100)
      : 0;
    
    console.log('KPIs geladen:', kpis);
    res.json(kpis);
    
  } catch (error) {
    console.error('Dashboard KPI Fehler:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Dashboard-Daten', 
      details: error.message 
    });
  }
});

// Bestellungen Historie (letzte 30 Tage)
router.get('/orders-history', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          CAST(b.dErstellt AS DATE) as date,
          COUNT(*) as orders,
          SUM(bp.total) as revenue
        FROM tBestellung b
        LEFT JOIN (
          SELECT 
            tBestellung_kBestellung,
            SUM(fVKNetto * nAnzahl) as total
          FROM tbestellpos
          GROUP BY tBestellung_kBestellung
        ) bp ON b.kBestellung = bp.tBestellung_kBestellung
        WHERE b.tKunde_kKunde = @kKunde
        AND b.dErstellt >= DATEADD(day, -30, GETDATE())
        AND b.nStorno = 0
        GROUP BY CAST(b.dErstellt AS DATE)
        ORDER BY date DESC
      `);
    
    res.json(result.recordset);
    
  } catch (error) {
    console.error('Orders history error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellhistorie' });
  }
});

// Test-Endpoint: Zeige Beispiel-Bestellungen
router.get('/test-orders', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT TOP 10
          b.kBestellung,
          b.cBestellNr,
          b.dErstellt,
          b.dVersandt,
          b.dBezahlt,
          b.cStatus,
          b.nStorno,
          k.cKundenNr,
          k.cFirma
        FROM tBestellung b
        INNER JOIN tKunde k ON b.tKunde_kKunde = k.kKunde
        WHERE b.tKunde_kKunde = @kKunde
        ORDER BY b.dErstellt DESC
      `);
    
    res.json({
      customerNumber: req.user.customerNumber,
      kKunde: kKunde,
      orderCount: result.recordset.length,
      orders: result.recordset
    });
    
  } catch (error) {
    console.error('Test orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Einzelverbindungsnachweis abrufen
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    // Monat aus Parameter oder aktueller Monat
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month}`);
    
    // Versanddaten abrufen - VEREINFACHTE QUERY
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('year', sql.Int, parseInt(year))
      .input('month', sql.Int, parseInt(monthNum))
      .query(`
        SELECT 
          v.kVersand,
          v.dErstellt as datum,
          v.cIdentCode as trackingNummer,
          CASE 
            WHEN v.cIdentCode LIKE 'LF%' THEN 'Deutsche Post'
            WHEN v.cIdentCode LIKE '0034%' THEN 'DHL'
            WHEN v.kVersandArt = 41 THEN 'DHL'
            WHEN v.kVersandArt = 85 THEN 'Deutsche Post'
            ELSE 'Standard'
          END as versanddienstleister,
          ISNULL(v.fGewicht, 0) as gewicht,
          0.0 as versandkosten,  -- Später können wir das berechnen
          b.cBestellNr as bestellNummer,
          b.cInetBestellNr as shopBestellNummer,
          a.cFirma as empfaengerFirma,
          ISNULL(a.cVorname, '') + ' ' + ISNULL(a.cName, '') as empfaengerName,
          ISNULL(a.cPLZ, '') + ' ' + ISNULL(a.cOrt, '') as empfaengerOrt,
          a.cLand as empfaengerLand,
          1 as anzahlPakete
        FROM tVersand v
        INNER JOIN tLieferschein l ON v.kLieferschein = l.kLieferschein
        INNER JOIN tBestellung b ON l.kBestellung = b.kBestellung
        LEFT JOIN tAdresse a ON b.kLieferadresse = a.kAdresse
        WHERE b.tKunde_kKunde = @kKunde
          AND YEAR(v.dErstellt) = @year
          AND MONTH(v.dErstellt) = @month
        ORDER BY v.dErstellt DESC
      `);
    
    console.log(`Gefundene Versanddaten: ${result.recordset.length} Einträge`);
    
    // Zusammenfassung berechnen
    const summary = {
      totalPackages: result.recordset.length,
      totalWeight: result.recordset.reduce((sum, r) => sum + (r.gewicht || 0), 0),
      totalCost: result.recordset.reduce((sum, r) => sum + (r.versandkosten || 0), 0),
      byCarrier: {}
    };
    
    // Nach Versanddienstleister gruppieren
    result.recordset.forEach(record => {
      const carrier = record.versanddienstleister || 'Sonstige';
      if (!summary.byCarrier[carrier]) {
        summary.byCarrier[carrier] = {
          count: 0,
          cost: 0
        };
      }
      summary.byCarrier[carrier].count++;
      summary.byCarrier[carrier].cost += record.versandkosten || 0;
    });
    
    res.json({
      month,
      records: result.recordset,
      summary
    });
    
  } catch (error) {
    console.error('Einzelverbindungsnachweis Fehler:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden des Einzelverbindungsnachweises',
      details: error.message 
    });
  }
});

module.exports = router;