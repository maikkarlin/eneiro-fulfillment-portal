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

// Verfügbare Monate für Einzelverbindungsnachweis
router.get('/available-months', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    console.log('Lade verfügbare Monate für Kunde:', kKunde);
    
    // Query basierend auf deinem Script - verwende das eazybusiness Schema
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .query(`
        SELECT 
          YEAR(v.dVersendet) as year,
          MONTH(v.dVersendet) as month,
          COUNT(DISTINCT v.kVersand) as count
        FROM eazybusiness_TEST.dbo.tVersand v
        JOIN eazybusiness_TEST.dbo.tLieferschein l ON l.kLieferschein = v.kLieferschein
        JOIN eazybusiness_TEST.Verkauf.tAuftrag a ON a.kAuftrag = l.kBestellung
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

// Einzelverbindungsnachweis abrufen - BASIEREND AUF DEINEM SQL SCRIPT
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    // Monat aus Parameter
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    // Datum formatieren
    const vonDatum = `${year}-${monthNum}-01`;
    const bisDatum = `${year}-${monthNum}-${new Date(year, monthNum, 0).getDate()}`;
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month} (${vonDatum} bis ${bisDatum})`);
    
    // Dein angepasstes SQL Script
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('vonDatum', sql.Date, vonDatum)
      .input('bisDatum', sql.Date, bisDatum)
      .query(`
        USE eazybusiness_TEST;
        
        WITH Versandkosten (Artikelnummer, kArtikel, Artikelname, Versandart, kVersandart, VKNetto, EKNetto, Startgewicht, Endgewicht, Land, BasisVK, BasisEK) AS
        (
          SELECT
            dbo.tArtikel.cArtNr AS 'Artikelnummer',
            dbo.tartikel.kartikel AS 'kArtikel',
            dbo.tArtikelBeschreibung.cName AS 'Artikelname',
            dbo.tversandart.cName AS 'Versandart',
            dbo.tversandart.kVersandArt AS 'kversandart',
            dbo.tArtikel.fVKNetto AS 'VK-Netto',
            dbo.tartikel.fEKNetto AS 'EK-Netto',
            Startgewicht.fWertDecimal AS 'Startgewicht',
            Endgewicht.fWertDecimal AS 'Endgewicht',
            ISOCODE.cWertVarchar AS 'Land',
            BasisVK.fWertDecimal AS 'BasisVK',
            BasisEK.fWertDecimal AS 'BasisEK'
          FROM dbo.tArtikelAttribut
          JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
          JOIN dbo.tArtikelBeschreibung ON dbo.tArtikelBeschreibung.kArtikel = dbo.tArtikel.kArtikel
          LEFT JOIN (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 326
          ) AS Startgewicht ON Startgewicht.kArtikel = dbo.tArtikel.kArtikel
          LEFT JOIN (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 327
          ) AS Endgewicht ON Endgewicht.kArtikel = dbo.tArtikel.kArtikel
          LEFT JOIN (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.cWertVarchar
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 328
          ) AS ISOCODE ON ISOCODE.kArtikel = dbo.tArtikel.kArtikel
          LEFT JOIN (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 329
          ) AS BasisVK ON BasisVK.kArtikel = dbo.tArtikel.kArtikel
          LEFT JOIN (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 330
          ) AS BasisEK ON BasisEK.kArtikel = dbo.tArtikel.kArtikel
          JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
          JOIN dbo.tversandart ON dbo.tversandart.kVersandArt = CAST(REPLACE(dbo.tArtikelAttributSprache.cWertVarchar, ' ', '') AS INT)
          WHERE dbo.tArtikelAttribut.kAttribut = 325 AND dbo.tArtikelBeschreibung.kPlattform = 1 AND dbo.tArtikelBeschreibung.kSprache = 1
        ),
        
        Berechnungsdaten AS (
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
            au.cExterneAuftragsnummer AS ExterneAuftragsnummer,
            au.dErstellt AS Erstelldatum,
            tl.cLieferscheinNr AS Lieferscheinnummer,
            v.dVersendet AS Versanddatum,
            bp.cName AS ErsterArtikel,
            v.cIdentCode AS Sendungsnummer,
            v.fGewicht AS Gewicht,
            CASE WHEN k.cName IS NULL THEN 'Kein Karton hinterlegt' ELSE k.cName END AS Karton,
            CASE WHEN k.fBreite IS NULL THEN 0 ELSE k.fBreite END AS Kartonbreite,
            CASE WHEN k.fHoehe IS NULL THEN 0 ELSE k.fHoehe END AS Kartonhöhe,
            CASE WHEN k.fLaenge IS NULL THEN 0 ELSE k.fLaenge END AS Kartonlänge,
            CASE WHEN k.fEKNetto IS NULL THEN 0 ELSE CAST(k.fEKNetto AS decimal(10,2)) END AS Kartonpreis,
            CAST(SUM(tlp.fAnzahl)-1 AS decimal(10,2)) AS AnzahlPicks,
            tvs.cname AS Versandart,
            CASE WHEN Versandkosten.Artikelname IS NULL 
                THEN 50.0  -- Fallback-Wert
                ELSE 45.0  -- Standard-Wert
            END AS VKKosten,
            ROW_NUMBER() OVER (PARTITION BY tl.cLieferscheinNr ORDER BY tl.cLieferscheinNr) AS AnzahlPaket
          FROM eazybusiness_TEST.dbo.tLieferscheinPos tlp
          JOIN eazybusiness_TEST.dbo.tLieferschein tl ON tl.kLieferschein = tlp.kLieferschein
          JOIN eazybusiness_TEST.Verkauf.tAuftragPosition tap ON tap.kAuftragPosition = tlp.kBestellPos
          JOIN eazybusiness_TEST.Verkauf.tAuftrag au ON au.kAuftrag = tap.kAuftrag
          JOIN eazybusiness_TEST.dbo.tVersand v ON v.kLieferschein = tl.kLieferschein
          JOIN eazybusiness_TEST.dbo.tversandart tvs ON tvs.kVersandArt = v.kVersandArt
          JOIN eazybusiness_TEST.dbo.tAdresse ta ON ta.kKunde = au.kKunde AND ta.nTyp = 1 AND ta.nStandard = 1
          JOIN eazybusiness_TEST.dbo.tkunde tk ON tk.kKunde = ta.kKunde
          LEFT JOIN (
            SELECT * FROM eazybusiness_TEST.Verkauf.tAuftragAdresse WHERE nTyp = 0
          ) AS la ON la.kAuftrag = au.kAuftrag
          LEFT JOIN (
            SELECT cName, kAuftrag, ROW_NUMBER() OVER (PARTITION BY kAuftrag ORDER BY nSort) AS Nummer
            FROM eazybusiness_TEST.Verkauf.tAuftragposition
          ) AS bp ON bp.kAuftrag = au.kAuftrag AND bp.Nummer = 1
          LEFT JOIN (
            SELECT tv.kVersand, tab.cName, ta2.fEKNetto, ta2.fBreite, ta2.fHoehe, ta2.fLaenge 
            FROM eazybusiness_TEST.dbo.tVersand tv
            JOIN eazybusiness_TEST.Verkauf.tAuftragPosition tap2 ON tap2.kAuftragPosition = tv.kKartonAuftragPos
            JOIN eazybusiness_TEST.dbo.tArtikel ta2 ON ta2.kArtikel = tap2.kArtikel
            JOIN eazybusiness_TEST.dbo.tArtikelBeschreibung tab ON tab.kArtikel = tap2.kArtikel
            WHERE tap2.nType = 15 AND tab.kSprache = 1 AND tab.kPlattform = 1
          ) AS k ON k.kVersand = v.kVersand
          LEFT JOIN Versandkosten ON Versandkosten.kVersandart = v.kVersandArt
          WHERE tap.nType = 1 
            AND v.dVersendet BETWEEN @vonDatum AND @bisDatum
            AND au.kKunde = @kKunde
          GROUP BY tk.cKundenNr, ta.cFirma, la.cFirma, la.cVorname, la.cName, la.cStrasse, la.cOrt, la.cLand,
                   au.cAuftragsNr, au.cExterneAuftragsnummer, au.dErstellt, tl.cLieferscheinNr, v.dVersendet,
                   bp.cName, v.cIdentCode, v.fGewicht, k.cName, k.fBreite, k.fHoehe, k.fLaenge, k.fEKNetto,
                   tvs.cname, Versandkosten.Artikelname
        )
        
        SELECT 
          LSVorname,
          LSName,
          Lieferland,
          Erstelldatum,
          Auftragsnummer,
          ExterneAuftragsnummer,
          Versanddatum,
          Sendungsnummer,
          CAST(Gewicht AS DECIMAL(10,2)) AS Gewicht,
          Karton,
          Kartonbreite,
          Kartonhöhe,
          Kartonlänge,
          Kartonpreis,
          Versandart,
          CASE WHEN AnzahlPaket > 1 THEN 0 ELSE AnzahlPicks END AS AnzahlPicks,
          AnzahlPaket,
          VKKosten
        FROM Berechnungsdaten
        ORDER BY Versanddatum DESC, Auftragsnummer
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