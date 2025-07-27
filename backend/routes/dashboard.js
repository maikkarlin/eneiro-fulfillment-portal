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

// Einzelverbindungsnachweis abrufen - NEUE IMPLEMENTIERUNG basierend auf Ihrem SQL
router.get('/itemized-records/:month?', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const kKunde = req.user.kKunde;
    
    // Monat aus Parameter
    const month = req.params.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-');
    
    console.log(`Lade Einzelverbindungsnachweis für Kunde ${kKunde}, Monat: ${month}`);
    
    // Ihre SQL-Query angepasst mit Parametern
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('vonDatum', sql.Date, `${year}-${monthNum}-01`)
      .input('bisDatum', sql.Date, `${year}-${monthNum}-${new Date(year, monthNum, 0).getDate()}`)
      .query(`
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
            eazybusiness.dbo.tkunde.cKundenNr AS 'Kundennummer',
            eazybusiness.dbo.tAdresse.cFirma AS 'Kundenname',
            Lieferadresse.cFirma AS 'LSFirma',
            Lieferadresse.cVorname AS 'LSVorname',
            Lieferadresse.cName AS 'LSName',
            Lieferadresse.cStrasse AS 'LSStraße',
            Lieferadresse.cOrt AS 'LSOrt',
            Lieferadresse.cLand AS 'Lieferland',
            eazybusiness.Verkauf.tAuftrag.cAuftragsNr AS 'Auftragsnummer',
            eazybusiness.Verkauf.tAuftrag.cExterneAuftragsnummer AS 'ExterneAuftragsnummer',
            eazybusiness.Verkauf.tAuftrag.dErstellt AS 'Erstelldatum',
            eazybusiness.dbo.tLieferschein.cLieferscheinNr AS 'Lieferscheinnummer',
            Versand.dVersendet AS 'Versanddatum',
            Bestellposition.cName AS 'ErsterArtikel',
            Versand.cIdentCode AS 'Sendungsnummer',
            Versand.fgewicht AS 'Gewicht',
            CASE WHEN Karton.cName IS NULL THEN 'Kein Karton hinterlegt' ELSE Karton.cName END AS 'Karton',
            CASE WHEN Karton.fBreite IS NULL THEN 0 ELSE Karton.fBreite END AS 'Kartonbreite',
            CASE WHEN Karton.fHoehe IS NULL THEN 0 ELSE Karton.fHoehe END AS 'Kartonhöhe',
            CASE WHEN Karton.fLaenge IS NULL THEN 0 ELSE Karton.fLaenge END AS 'Kartonlänge',
            CASE WHEN Karton.fEKNetto IS NULL THEN 0 ELSE CAST(Karton.fEKNetto AS decimal (10,2)) END AS 'Kartonpreis',
            CAST(SUM(eazybusiness.dbo.tLieferscheinPos.fAnzahl)-1 AS decimal (10,2)) AS 'AnzahlPicks',
            CAST(SUM(eazybusiness.dbo.tLieferscheinPos.fAnzahl)-1 AS decimal (10,2)) * KostenPicksRabatt.dNettoPreis AS 'KostenPicksRabatt',
            eazybusiness.dbo.tversandart.cname AS 'Versandart',
            CASE WHEN Versandkosten.Artikelname IS NULL 
                THEN ((SELECT dNettoPreis FROM [dbo].[ifGetNetPrice](International.kArtikel, Verkauf.tAuftrag.kKunde, dbo.tkunde.kKundenGruppe, 0, 0))) 
                ELSE (SELECT dNettoPreis FROM [dbo].[ifGetNetPrice](Versandkosten.kArtikel, Verkauf.tAuftrag.kKunde, dbo.tkunde.kKundenGruppe, 0, 0)) 
            END AS 'VKKosten',
            CASE WHEN Versandkosten.Artikelname IS NULL 
                THEN International.EKNetto
                ELSE Versandkosten.EKNetto
            END AS 'EKKosten'
          FROM eazybusiness.dbo.tLieferscheinPos
          JOIN eazybusiness.dbo.tLieferschein ON eazybusiness.dbo.tLieferschein.kLieferschein = eazybusiness.dbo.tLieferscheinPos.kLieferschein
          JOIN eazybusiness.Verkauf.tAuftragPosition ON eazybusiness.Verkauf.tAuftragPosition.kAuftragPosition = eazybusiness.dbo.tLieferscheinPos.kBestellPos
          JOIN eazybusiness.Verkauf.tAuftrag ON eazybusiness.Verkauf.tAuftrag.kAuftrag = eazybusiness.Verkauf.tAuftragPosition.kAuftrag
          JOIN (SELECT * FROM eazybusiness.Verkauf.tAuftragAdresse WHERE nTyp = 0) AS Lieferadresse ON Lieferadresse.kAuftrag = eazybusiness.Verkauf.tAuftrag.kAuftrag
          JOIN eazybusiness.dbo.tAdresse ON eazybusiness.dbo.tAdresse.kKunde = eazybusiness.Verkauf.tAuftrag.kKunde
          JOIN eazybusiness.dbo.tkunde ON eazybusiness.dbo.tkunde.kKunde = eazybusiness.dbo.tAdresse.kKunde
          JOIN (
            SELECT kversand, kLieferschein, CAST(dVersendet AS DATE) AS dVersendet, cIdentCode, kVersandArt, fGewicht 
            FROM eazybusiness.dbo.tVersand
          ) AS Versand ON Versand.kLieferschein = eazybusiness.dbo.tLieferschein.kLieferschein
          JOIN eazybusiness.dbo.tversandart ON eazybusiness.dbo.tversandart.kVersandArt = Versand.kVersandArt
          LEFT JOIN Versandkosten ON Versandkosten.kVersandart = Versand.kVersandArt 
            AND CASE WHEN Versand.fGewicht < 0 THEN 1 WHEN Versand.fGewicht > 35 THEN 35 ELSE Versand.fGewicht END 
            BETWEEN Versandkosten.Startgewicht AND Versandkosten.Endgewicht
          LEFT JOIN (
            SELECT * FROM Versandkosten WHERE Land <> 'DE'
          ) AS International ON International.kVersandart = Versand.kVersandArt 
            AND International.Land = Lieferadresse.ciso
          JOIN (
            SELECT cName, kAuftrag, ROW_NUMBER() OVER (PARTITION BY kAuftrag ORDER BY nSort) AS Nummer
            FROM eazybusiness.Verkauf.tAuftragposition
          ) AS Bestellposition ON Bestellposition.kAuftrag = eazybusiness.Verkauf.tAuftrag.kAuftrag AND Nummer = 1
          LEFT JOIN (
            SELECT v.kVersand, v.kKartonAuftragPos, ab.cName, ta.fEKNetto, ta.fBreite, ta.fHoehe, ta.fLaenge 
            FROM eazybusiness.dbo.tVersand v
            JOIN eazybusiness.dbo.tLieferschein l ON l.kLieferschein = v.kLieferschein
            JOIN eazybusiness.Verkauf.tAuftragPosition ap ON ap.kAuftragPosition = v.kKartonAuftragPos
            JOIN eazybusiness.dbo.tArtikel ta ON ta.kArtikel = ap.kArtikel
            JOIN eazybusiness.dbo.tArtikelBeschreibung ab ON ab.kArtikel = ap.kArtikel
            WHERE ap.nType = 15 AND ab.kSprache = 1 AND ab.kPlattform = 1
          ) AS Karton ON Karton.kVersand = Versand.kVersand
          JOIN (
            SELECT k.kKunde, p.dNettoPreis
            FROM eazybusiness.dbo.tkunde k
            CROSS APPLY eazybusiness.[dbo].[ifGetNetPrice](5398, k.kKunde, k.kKundenGruppe, 0, 1) p
          ) AS KostenPicksRabatt ON KostenPicksRabatt.kKunde = eazybusiness.Verkauf.tAuftrag.kKunde
          WHERE eazybusiness.Verkauf.tAuftragPosition.nType = 1 
            AND Versand.dVersendet BETWEEN @vonDatum AND @bisDatum
            AND eazybusiness.Verkauf.tAuftrag.kKunde = @kKunde
            AND eazybusiness.dbo.tAdresse.nTyp = 1 AND eazybusiness.dbo.tAdresse.nStandard = 1
          GROUP BY 
            eazybusiness.dbo.tkunde.cKundenNr, eazybusiness.dbo.tAdresse.cFirma, Lieferadresse.cFirma,
            Lieferadresse.cVorname, Lieferadresse.cName, Lieferadresse.cStrasse, Lieferadresse.cOrt,
            Lieferadresse.cLand, eazybusiness.Verkauf.tAuftrag.cAuftragsNr, 
            eazybusiness.Verkauf.tAuftrag.cExterneAuftragsnummer, eazybusiness.Verkauf.tAuftrag.dErstellt,
            eazybusiness.dbo.tLieferschein.cLieferscheinNr, Versand.dVersendet, Bestellposition.cName,
            Versand.cIdentCode, Versand.fGewicht, Karton.cName, Karton.fEKNetto, Karton.fBreite,
            Karton.fHoehe, Karton.fLaenge, eazybusiness.dbo.tversandart.cname, KostenPicksRabatt.dNettoPreis,
            Versandkosten.Artikelname, Versandkosten.kArtikel, International.kArtikel, International.EKNetto,
            Versandkosten.EKNetto, eazybusiness.Verkauf.tAuftrag.kKunde, eazybusiness.dbo.tkunde.kKundenGruppe
        ),
        
        Berechnunguebersicht AS (
          SELECT 
            Kundennummer, Kundenname, LSFirma, LSVorname, LSName, LSStraße, LSOrt, Lieferland,
            Erstelldatum, Auftragsnummer, ExterneAuftragsnummer, ErsterArtikel, Lieferscheinnummer, 
            Versanddatum, Sendungsnummer, CAST(Gewicht AS DECIMAL(10,2)) AS 'Gewicht',
            Karton, Kartonbreite, Kartonhöhe, Kartonlänge, Kartonpreis, Versandart,
            CASE WHEN ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) > 1 
                 THEN 0 ELSE AnzahlPicks END AS 'AnzahlPicks', 
            CASE WHEN ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) > 1 
                 THEN 0 ELSE KostenPicksRabatt END AS 'KostenPicks', 
            ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) AS 'AnzahlPaket', 
            VKKosten, EKKosten
          FROM Berechnungsdaten
        )
        
        SELECT * FROM Berechnunguebersicht
        ORDER BY Versanddatum DESC, Auftragsnummer DESC
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