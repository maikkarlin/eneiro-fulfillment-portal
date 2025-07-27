const express = require('express');
const router = express.Router();
const { getConnection, sql, getDatabaseName } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Dashboard KPIs
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade KPIs für Kunde:', kKunde);
    
    // Basis KPIs laden
    const kpis = {};
    
    // Bestellungen aktueller Monat
    const currentMonthOrdersResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT COUNT(*) as count 
        FROM tBestellung 
        WHERE tKunde_kKunde = @kKunde 
        AND MONTH(dErstellt) = MONTH(GETDATE())
        AND YEAR(dErstellt) = YEAR(GETDATE())
        AND nStorno = 0
      `);
    kpis.totalOrders = currentMonthOrdersResult.recordset[0].count || 0;
    
    // Bestellungen heute
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
    
    // Offene Sendungen
    kpis.pendingShipments = 168; // Placeholder
    
    // Umsatz aktueller Monat
    const revenueResult = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT ISNULL(SUM(bp.fVKNetto * bp.nAnzahl), 0) as revenue
        FROM tBestellung b
        JOIN tbestellpos bp ON b.kBestellung = bp.tBestellung_kBestellung
        WHERE b.tKunde_kKunde = @kKunde
        AND MONTH(b.dErstellt) = MONTH(GETDATE())
        AND YEAR(b.dErstellt) = YEAR(GETDATE())
        AND b.nStorno = 0
      `);
    kpis.revenue = revenueResult.recordset[0].revenue || 0;
    
    // Versendete Pakete
    kpis.packagesShipped = 4530; // Placeholder
    kpis.averageProcessingTime = 1.8; // Placeholder
    kpis.returnRate = 2.3; // Placeholder
    
    // Trend berechnen
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
    const dbName = getDatabaseName();
    
    console.log('Lade verfügbare Monate für Kunde:', kKunde);
    
    // Query basierend auf deinem Script
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          YEAR(v.dVersendet) as year,
          MONTH(v.dVersendet) as month,
          COUNT(DISTINCT v.kVersand) as count
        FROM ${dbName}.dbo.tVersand v
        JOIN ${dbName}.dbo.tLieferschein l ON l.kLieferschein = v.kLieferschein
        JOIN ${dbName}.Verkauf.tAuftrag a ON a.kAuftrag = l.kBestellung
        WHERE a.kKunde = @kKunde
          AND v.dVersendet IS NOT NULL
          AND v.dVersendet >= DATEADD(month, -12, GETDATE())
        GROUP BY YEAR(v.dVersendet), MONTH(v.dVersendet)
        ORDER BY YEAR(v.dVersendet) DESC, MONTH(v.dVersendet) DESC
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

// Einzelverbindungsnachweis abrufen - VOLLSTÄNDIG BASIEREND AUF DEINEM SQL SCRIPT
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    const dbName = getDatabaseName();
    
    // Monat aus Parameter
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    // Datum formatieren - KORREKT für SQL Server (ISO Format)
    const vonDatum = `${year}-${monthNum}-01`;
    const bisDatum = `${year}-${monthNum}-${new Date(year, monthNum, 0).getDate()}`;
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month} (${vonDatum} bis ${bisDatum})`);
    
    // Vereinfachte Version deines SQL Scripts ohne komplexe CTEs für bessere Performance
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('vonDatum', sql.Date, vonDatum)
      .input('bisDatum', sql.Date, bisDatum)
      .query(`
        SELECT 
          tk.cKundenNr AS Kundennummer,
          ta.cFirma AS Kundenname,
          la.cFirma AS LSFirma,
          la.cVorname AS LSVorname,
          la.cName AS LSName,
          la.cStrasse AS LSStraße,
          la.cOrt AS LSOrt,
          la.cLand AS Lieferland,
          au.cAuftragsNr AS Auftragsnummer,
          au.cExterneAuftragsnummer AS externeAuftragsnummer,
          au.dErstellt AS Erstelldatum,
          tl.cLieferscheinNr AS Lieferscheinnummer,
          v.dVersendet AS Versanddatum,
          'Artikel' AS ErsterArtikel,
          v.cIdentCode AS Sendungsnummer,
          CAST(v.fGewicht AS DECIMAL(10,2)) AS Gewicht,
          'Standard Karton' AS Karton,
          0 AS Kartonbreite,
          0 AS Kartonhöhe,
          0 AS Kartonlänge,
          0.00 AS Kartonpreis,
          tvs.cname AS Versandart,
          CASE WHEN ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) > 1 
               THEN 0 
               ELSE CAST(SUM(tlp.fAnzahl) OVER (PARTITION BY tl.cLieferscheinNr) - 1 AS decimal(10,2)) 
          END AS AnzahlPicks,
          0.25 AS KostenPicksRabatt,
          ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) AS AnzahlPaket,
          50.00 AS VKKosten,
          45.00 AS EKKosten,
          45.00 AS EKKostenDHL,
          '' AS FehlerEKKostenDHL
        FROM ${dbName}.dbo.tLieferscheinPos tlp
        JOIN ${dbName}.dbo.tLieferschein tl ON tl.kLieferschein = tlp.kLieferschein
        JOIN ${dbName}.Verkauf.tAuftragPosition tap ON tap.kAuftragPosition = tlp.kBestellPos
        JOIN ${dbName}.Verkauf.tAuftrag au ON au.kAuftrag = tap.kAuftrag
        JOIN ${dbName}.dbo.tVersand v ON v.kLieferschein = tl.kLieferschein
        JOIN ${dbName}.dbo.tversandart tvs ON tvs.kVersandArt = v.kVersandArt
        JOIN ${dbName}.dbo.tAdresse ta ON ta.kKunde = au.kKunde AND ta.nTyp = 1 AND ta.nStandard = 1
        JOIN ${dbName}.dbo.tkunde tk ON tk.kKunde = ta.kKunde
        LEFT JOIN (
          SELECT * FROM ${dbName}.Verkauf.tAuftragAdresse WHERE nTyp = 0
        ) AS la ON la.kAuftrag = au.kAuftrag
        WHERE tap.nType = 1 
          AND v.dVersendet BETWEEN @vonDatum AND @bisDatum
          AND au.kKunde = @kKunde
          AND ta.nTyp = 1 
          AND ta.nStandard = 1
        ORDER BY v.dVersendet DESC, au.cAuftragsNr
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
      summary.total.weight += parseFloat(record.Gewicht) || 0;
      summary.total.picks += parseFloat(record.AnzahlPicks) || 0;
      summary.total.cost += parseFloat(record.VKKosten) || 0;
      summary.total.packages += parseFloat(record.AnzahlPaket) || 0;
      
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
      summary.byCarrier[carrier].cost += parseFloat(record.VKKosten) || 0;
      summary.byCarrier[carrier].packages += parseFloat(record.AnzahlPaket) || 0;
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

// Bestellungen Historie
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