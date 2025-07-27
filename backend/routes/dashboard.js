const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getConnection, sql } = require('../config/database');

// Dashboard KPIs abrufen (funktioniert bereits)
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

// Verfügbare Monate für Einzelverbindungsnachweis (funktioniert bereits)
router.get('/available-months', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade verfügbare Monate für Kunde:', kKunde);
    
    // Vereinfachte Query - verwende die bestehende Bestellungstabelle
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          YEAR(dVersandt) as year,
          MONTH(dVersandt) as month,
          COUNT(*) as count
        FROM tBestellung
        WHERE tKunde_kKunde = @kKunde
          AND dVersandt IS NOT NULL
          AND dVersandt >= DATEADD(month, -12, GETDATE())
          AND nStorno = 0
        GROUP BY YEAR(dVersandt), MONTH(dVersandt)
        ORDER BY YEAR(dVersandt) DESC, MONTH(dVersandt) DESC
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

// Einzelverbindungsnachweis abrufen - KORRIGIERTE VEREINFACHTE VERSION
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    // Monat aus Parameter
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month}`);
    
    // Vereinfachte Query basierend auf bestehenden funktionierenden Tabellen
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('year', sql.Int, parseInt(year))
      .input('month', sql.Int, parseInt(monthNum))
      .query(`
        SELECT 
          b.dVersandt as Versanddatum,
          b.cBestellNr as Auftragsnummer,
          bp.cArtNr as Artikelnummer,
          bp.cName as Artikelname,
          bp.nAnzahl as Anzahl,
          bp.fGewicht as Gewicht,
          'Standard' as Versandart,
          bp.fVKNetto * bp.nAnzahl as VKKosten,
          1 as AnzahlPaket
        FROM tBestellung b
        INNER JOIN tbestellpos bp ON b.kBestellung = bp.tBestellung_kBestellung
        WHERE b.tKunde_kKunde = @kKunde
          AND YEAR(b.dVersandt) = @year
          AND MONTH(b.dVersandt) = @month
          AND b.dVersandt IS NOT NULL
          AND b.nStorno = 0
        ORDER BY b.dVersandt DESC, b.cBestellNr
      `);
    
    // Zusammenfassung berechnen
    const summary = {
      total: {
        weight: 0,
        picks: 0,
        cost: 0,
        packages: 0
      },
      byCarrier: {}
    };
    
    result.recordset.forEach(record => {
      // Gesamtsummen
      summary.total.weight += record.Gewicht || 0;
      summary.total.picks += record.Anzahl || 0;
      summary.total.cost += record.VKKosten || 0;
      summary.total.packages += record.AnzahlPaket || 0;
      
      // Nach Versanddienstleister
      const carrier = record.Versandart || 'Standard';
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
    
    console.log(`Einzelverbindungsnachweis erfolgreich geladen: ${result.recordset.length} Einträge`);
    
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

// Bestellungen Historie (funktioniert bereits)
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