const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getConnection, sql } = require('../config/database');

// Dashboard KPIs abrufen (bleibt unverändert)
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade KPIs für Kunde:', kKunde);
    
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
    
    // 3. Offene Bestellungen
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
    
    // 4. Umsatz aktueller Monat
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
    
    // 5. Versendete Bestellungen
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
    
    // 6. Mock-Daten
    kpis.averageProcessingTime = 1.8;
    kpis.returnRate = 2.3;
    
    // 7. Trend
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

// Verfügbare Monate für Einzelverbindungsnachweis
router.get('/available-months', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade verfügbare Monate für Kunde:', kKunde);
    
    // Query basierend auf Ihrem Script - sucht nach Versanddaten
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          YEAR(Versand.dVersendet) as year,
          MONTH(Versand.dVersendet) as month,
          COUNT(*) as count
        FROM eazybusiness.dbo.tLieferscheinPos
        JOIN eazybusiness.dbo.tLieferschein ON eazybusiness.dbo.tLieferschein.kLieferschein = eazybusiness.dbo.tLieferscheinPos.kLieferschein
        JOIN eazybusiness.Verkauf.tAuftragPosition ON eazybusiness.Verkauf.tAuftragPosition.kAuftragPosition = eazybusiness.dbo.tLieferscheinPos.kBestellPos
        JOIN eazybusiness.Verkauf.tAuftrag ON eazybusiness.Verkauf.tAuftrag.kAuftrag = eazybusiness.Verkauf.tAuftragPosition.kAuftrag
        JOIN (
          SELECT kversand, kLieferschein, CAST(dVersendet AS DATE) AS dVersendet, cIdentCode, kVersandArt, fGewicht 
          FROM eazybusiness.dbo.tVersand
          GROUP BY kversand, kLieferschein, CAST(dVersendet AS DATE), cIdentCode, kVersandArt, fGewicht 
        ) AS Versand ON Versand.kLieferschein = eazybusiness.dbo.tLieferschein.kLieferschein
        WHERE eazybusiness.Verkauf.tAuftrag.kKunde = @kKunde
          AND Versand.dVersendet >= DATEADD(month, -12, GETDATE())
          AND eazybusiness.Verkauf.tAuftragPosition.nType = 1
        GROUP BY YEAR(Versand.dVersendet), MONTH(Versand.dVersendet)
        ORDER BY YEAR(Versand.dVersendet) DESC, MONTH(Versand.dVersendet) DESC
      `);
    
    const months = result.recordset.map(row => {
      const year = row.year;
      const month = row.month;
      const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
      ];
      
      return {
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${monthNames[month - 1]} ${year}`,
        count: row.count
      };
    });
    
    console.log('Verfügbare Monate:', months);
    res.json(months);
    
  } catch (error) {
    console.error('Available months error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der verfügbaren Monate',
      details: error.message 
    });
  }
});

// Einzelverbindungsnachweis abrufen - VEREINFACHTE VERSION für Tests
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    // Monat aus Parameter
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month}`);
    
    // VEREINFACHTE QUERY basierend auf funktionierenden available-months
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('year', sql.Int, parseInt(year))
      .input('month', sql.Int, parseInt(monthNum))
      .query(`
        SELECT 
          v.kVersand,
          v.dVersendet as Versanddatum,
          v.cIdentCode as Sendungsnummer,
          ISNULL(v.fGewicht, 0) as Gewicht,
          CASE 
            WHEN v.cIdentCode LIKE 'LF%' THEN 'Deutsche Post'
            WHEN v.cIdentCode LIKE '0034%' THEN 'DHL'
            WHEN v.kVersandArt = 41 THEN 'DHL'
            WHEN v.kVersandArt = 85 THEN 'Deutsche Post'
            ELSE 'Standard'
          END as Versandart,
          b.cBestellNr as Auftragsnummer,
          b.dErstellt as Erstelldatum,
          'Test Vorname' as LSVorname,
          'Test Name' as LSName,
          'Deutschland' as Lieferland,
          'Test extern' as ExterneAuftragsnummer,
          'Test Karton' as Karton,
          0.25 as Kartonpreis,
          1 as AnzahlPicks,
          1 as AnzahlPaket,
          CASE 
            WHEN v.kVersandArt = 41 THEN 4.99
            WHEN v.kVersandArt = 85 THEN 2.70
            ELSE 3.50
          END as VKKosten
        FROM tVersand v
        INNER JOIN tLieferschein l ON v.kLieferschein = l.kLieferschein
        INNER JOIN tBestellung b ON l.kBestellung = b.kBestellung
        WHERE b.tKunde_kKunde = @kKunde
          AND YEAR(v.dVersendet) = @year
          AND MONTH(v.dVersendet) = @month
        ORDER BY v.dVersendet DESC
      `);
    
    console.log(`Gefundene Versanddaten: ${result.recordset.length} Einträge`);
    
    // Zusammenfassung berechnen
    const summary = {
      totalPackages: result.recordset.reduce((sum, r) => sum + (r.AnzahlPaket || 0), 0),
      totalWeight: result.recordset.reduce((sum, r) => sum + (r.Gewicht || 0), 0),
      totalCost: result.recordset.reduce((sum, r) => sum + (r.VKKosten || 0), 0),
      totalPicks: result.recordset.reduce((sum, r) => sum + (r.AnzahlPicks || 0), 0),
      totalPickCosts: result.recordset.reduce((sum, r) => sum + (r.KostenPicks || 0), 0),
      totalBoxCosts: result.recordset.reduce((sum, r) => sum + (r.Kartonpreis || 0), 0),
      byCarrier: {}
    };
    
    // Nach Versanddienstleister gruppieren
    result.recordset.forEach(record => {
      const carrier = record.Versandart || 'Sonstige';
      if (!summary.byCarrier[carrier]) {
        summary.byCarrier[carrier] = {
          count: 0,
          cost: 0,
          packages: 0
        };
      }
      summary.byCarrier[carrier].count += 1;
      summary.byCarrier[carrier].cost += record.VKKosten || 0;
      summary.byCarrier[carrier].packages += record.AnzahlPaket || 0;
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

// Bestellungen Historie (bleibt unverändert)
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

module.exports = router;