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
          bp.cName AS ErsterArtikel,
          v.cIdentCode AS Sendungsnummer,
          CAST(v.fGewicht AS DECIMAL(10,2)) AS Gewicht,
          ISNULL(k.cName, 'Standard Karton') AS Karton,
          CAST(ISNULL(k.fBreite, 0) AS DECIMAL(10,2)) AS Kartonbreite,
          CAST(ISNULL(k.fHoehe, 0) AS DECIMAL(10,2)) AS Kartonhöhe,
          CAST(ISNULL(k.fLaenge, 0) AS DECIMAL(10,2)) AS Kartonlänge,
          CAST(ISNULL(k.fEKNetto, 0.00) AS DECIMAL(10,2)) AS Kartonpreis,
          tvs.cname AS Versandart,
          CASE WHEN ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) > 1 
               THEN 0.00
               ELSE CAST(SUM(tlp.fAnzahl) OVER (PARTITION BY tl.cLieferscheinNr) - 1 AS decimal(10,2)) 
          END AS AnzahlPicks,
          CASE WHEN ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) > 1 
               THEN 0.00
               ELSE CAST((SUM(tlp.fAnzahl) OVER (PARTITION BY tl.cLieferscheinNr) - 1) * ISNULL(kpr.dNettoPreis, 0.25) AS decimal(10,2))
          END AS KostenPicksRabatt,
          ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) AS AnzahlPaket,
          CAST(ISNULL(vs.dNettoPreis, 50.00) AS DECIMAL(10,2)) AS VKKosten
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
        LEFT JOIN (
          SELECT 
            ap.kAuftrag,
            ab.cName,
            ROW_NUMBER() OVER (PARTITION BY ap.kAuftrag ORDER BY ap.nSort) AS Nummer
          FROM ${dbName}.Verkauf.tAuftragposition ap
          JOIN ${dbName}.dbo.tArtikelBeschreibung ab ON ab.kArtikel = ap.kArtikel
          WHERE ab.kSprache = 1 AND ab.kPlattform = 1 AND ap.nType = 1
        ) AS bp ON bp.kAuftrag = au.kAuftrag AND bp.Nummer = 1
        LEFT JOIN (
          SELECT 
            tv.kVersand, 
            tab.cName, 
            ta2.fEKNetto, 
            ta2.fBreite, 
            ta2.fHoehe, 
            ta2.fLaenge 
          FROM ${dbName}.dbo.tVersand tv
          JOIN ${dbName}.Verkauf.tAuftragPosition tap2 ON tap2.kAuftragPosition = tv.kKartonAuftragPos
          JOIN ${dbName}.dbo.tArtikel ta2 ON ta2.kArtikel = tap2.kArtikel
          JOIN ${dbName}.dbo.tArtikelBeschreibung tab ON tab.kArtikel = tap2.kArtikel
          WHERE tap2.nType = 15 AND tab.kSprache = 1 AND tab.kPlattform = 1
        ) AS k ON k.kVersand = v.kVersand
        LEFT JOIN (
          SELECT
            Kunde.kKunde,
            p.dNettoPreis
          FROM ${dbName}.dbo.tkunde Kunde
          CROSS APPLY ${dbName}.[dbo].[ifGetNetPrice] (5398, Kunde.kKunde, Kunde.kKundenGruppe, 0, 1) p
        ) AS kpr ON kpr.kKunde = au.kKunde
        LEFT JOIN (
          SELECT
            au2.kKunde,
            vs2.kVersandArt,
            p2.dNettoPreis
          FROM ${dbName}.Verkauf.tAuftrag au2
          JOIN ${dbName}.dbo.tVersand vs2 ON vs2.kLieferschein IN (
            SELECT kLieferschein FROM ${dbName}.dbo.tLieferschein WHERE kBestellung = au2.kAuftrag
          )
          CROSS APPLY ${dbName}.[dbo].[ifGetNetPrice] (5000, au2.kKunde, (SELECT kKundenGruppe FROM ${dbName}.dbo.tkunde WHERE kKunde = au2.kKunde), 0, 0) p2
          GROUP BY au2.kKunde, vs2.kVersandArt, p2.dNettoPreis
        ) AS vs ON vs.kKunde = au.kKunde AND vs.kVersandArt = v.kVersandArt
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