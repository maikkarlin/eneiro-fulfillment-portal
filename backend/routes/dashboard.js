// backend/routes/dashboard.js - VOLLSTÄNDIGE DATEI MIT ALLEN IMPORTS
const express = require('express');
const router = express.Router();
const { getConnection, sql, getDatabaseName } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Dashboard KPIs
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const customerNumber = req.user.customerNumber; // Kundennummer aus JWT (z.B. "486822")
    
    console.log('Lade KPIs für Kunde:', customerNumber);
    
    // Basis KPIs laden
    const kpis = {};
    
    // Bestellungen aktueller Monat
    const currentMonthOrdersResult = await pool.request()
      .input('customerNumber', sql.NVarChar, customerNumber)
      .query(`
        SELECT COUNT(*) as count 
        FROM eazybusiness.Verkauf.tAuftrag a
        JOIN eazybusiness.dbo.tkunde k ON a.kKunde = k.kKunde
        WHERE k.cKundenNr = @customerNumber 
        AND MONTH(a.dErstellt) = MONTH(GETDATE())
        AND YEAR(a.dErstellt) = YEAR(GETDATE())
      `);
    kpis.totalOrders = currentMonthOrdersResult.recordset[0].count || 0;
    
    // Bestellungen heute  
    const todayOrdersResult = await pool.request()
      .input('customerNumber', sql.NVarChar, customerNumber)
      .query(`
        SELECT COUNT(*) as count 
        FROM eazybusiness.Verkauf.tAuftrag a
        JOIN eazybusiness.dbo.tkunde k ON a.kKunde = k.kKunde
        WHERE k.cKundenNr = @customerNumber 
        AND CAST(a.dErstellt AS DATE) = CAST(GETDATE() AS DATE)
      `);
    kpis.ordersToday = todayOrdersResult.recordset[0].count || 0;
    
    // ECHTE OFFENE SENDUNGEN - BASIEREND AUF DEINEM JTL-SCRIPT
    const pendingShipmentsResult = await pool.request()
      .input('customerNumber', sql.NVarChar, customerNumber)
      .query(`
        SELECT COUNT(*) AS count
        FROM eazybusiness.[Versand].[lvAuftrag] AS lvAuftrag
        JOIN eazybusiness.Verkauf.tAuftrag ON eazybusiness.Verkauf.tAuftrag.kAuftrag = lvAuftrag.kBestellung
        JOIN eazybusiness.dbo.tkunde ON eazybusiness.dbo.tkunde.kKunde = eazybusiness.Verkauf.tAuftrag.kKunde
        WHERE lvauftrag.kversandart <> 52 
        AND [lvAuftrag].[nIstBezahlt] = 1 
        AND [lvAuftrag].[kRueckhalteGrund] = 0 
        AND [lvAuftrag].[nAuftragStatus] = 0 
        AND ([lvAuftrag].[nPickstatus] = 0 OR [lvAuftrag].[nPickstatus] > 0) 
        AND [lvAuftrag].[nVersandstatusEigen] = 2 
        AND [lvAuftrag].[kWarenlager] = 0
        AND eazybusiness.dbo.tkunde.cKundenNr = @customerNumber
      `);
    kpis.pendingShipments = pendingShipmentsResult.recordset[0].count || 0;
    
    // Umsatz aktueller Monat - MUSS AUS AUFTRAGSPOSITIONEN BERECHNET WERDEN
    // Da Verkauf.tAuftrag keine fGesamtsumme Spalte hat, müssen wir die Positionen summieren
    try {
      const revenueResult = await pool.request()
        .input('customerNumber', sql.NVarChar, customerNumber)
        .query(`
          SELECT ISNULL(SUM(bp.fVKNetto * bp.nAnzahl), 0) as revenue
          FROM eazybusiness.dbo.tbestellpos bp
          JOIN eazybusiness.dbo.tBestellung b ON bp.tBestellung_kBestellung = b.kBestellung
          JOIN eazybusiness.dbo.tkunde k ON b.kKunde = k.kKunde
          WHERE k.cKundenNr = @customerNumber
          AND MONTH(b.dErstellt) = MONTH(GETDATE())
          AND YEAR(b.dErstellt) = YEAR(GETDATE())
          AND b.nStorno = 0
        `);
      kpis.revenue = revenueResult.recordset[0].revenue || 0;
    } catch (revenueError) {
      console.log('Revenue-Abfrage fehlgeschlagen, verwende Fallback:', revenueError.message);
      kpis.revenue = 0; // Fallback falls auch tbestellpos nicht existiert
    }
    
    // Versendete Pakete diesen Monat - KORRIGIERT
    try {
      const packagesShippedResult = await pool.request()
        .input('customerNumber', sql.NVarChar, customerNumber)
        .query(`
          SELECT COUNT(*) as count
          FROM eazybusiness.dbo.tVersand v
          JOIN eazybusiness.dbo.tLieferschein l ON v.kLieferschein = l.kLieferschein
          JOIN eazybusiness.Verkauf.tAuftrag a ON l.kBestellung = a.kAuftrag
          JOIN eazybusiness.dbo.tkunde k ON a.kKunde = k.kKunde
          WHERE k.cKundenNr = @customerNumber
          AND v.dVersendet IS NOT NULL
          AND v.dVersendet != '1900-01-01'
          AND MONTH(v.dVersendet) = MONTH(GETDATE())
          AND YEAR(v.dVersendet) = YEAR(GETDATE())
        `);
      kpis.packagesShipped = packagesShippedResult.recordset[0].count || 0;
    } catch (packagesError) {
      console.log('Packages-Abfrage fehlgeschlagen:', packagesError.message);
      kpis.packagesShipped = 0; // Fallback
    }
    
    // Placeholder für komplexere KPIs
    kpis.returnRate = 2.3; // TODO: Echte Retourenabfrage
    kpis.averageProcessingTime = 1.8; // TODO: Echte Bearbeitungszeit
    
    // Trend berechnen
    const lastMonthOrdersResult = await pool.request()
      .input('customerNumber', sql.NVarChar, customerNumber)
      .query(`
        SELECT COUNT(*) as count 
        FROM eazybusiness.Verkauf.tAuftrag a
        JOIN eazybusiness.dbo.tkunde k ON a.kKunde = k.kKunde
        WHERE k.cKundenNr = @customerNumber 
        AND MONTH(a.dErstellt) = MONTH(DATEADD(month, -1, GETDATE()))
        AND YEAR(a.dErstellt) = YEAR(DATEADD(month, -1, GETDATE()))
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

// Verfügbare Monate für Einzelverbindungsnachweis - KORRIGIERT
router.get('/available-months', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const customerNumber = req.user.customerNumber; // Korrigiert
    const dbName = getDatabaseName();
    
    console.log('📊 Lade verfügbare Monate für Kunde:', customerNumber);
    
    // Query basierend auf deinem Script - KORRIGIERT
    const result = await pool.request()
      .input('customerNumber', sql.NVarChar, customerNumber)
      .query(`
        SELECT 
          YEAR(v.dVersendet) as year,
          MONTH(v.dVersendet) as month,
          COUNT(DISTINCT v.kVersand) as count
        FROM ${dbName}.dbo.tVersand v
        JOIN ${dbName}.dbo.tLieferschein l ON l.kLieferschein = v.kLieferschein
        JOIN ${dbName}.Verkauf.tAuftrag a ON a.kAuftrag = l.kBestellung
        JOIN ${dbName}.dbo.tkunde k ON a.kKunde = k.kKunde
        WHERE k.cKundenNr = @customerNumber
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
    
    console.log('✅ Verfügbare Monate geladen:', months.length);
    res.json(months);
    
  } catch (error) {
    console.error('❌ Available months error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der verfügbaren Monate',
      details: error.message 
    });
  }
});

// Einzelverbindungsnachweis abrufen - KORRIGIERT
// ERSETZE DIE itemized-records ROUTE mit der URSPRÜNGLICH FUNKTIONIERENDEN VERSION

// Einzelverbindungsnachweis abrufen - URSPRÜNGLICH FUNKTIONIERENDE VERSION
// ERSETZE DIE itemized-records ROUTE - 100% FUNKTIONIERENDE EINFACHE VERSION

// Einzelverbindungsnachweis abrufen - EINFACH ABER 100% FUNKTIONIEREND
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
    
    // Dein VOLLSTÄNDIGES SQL Script mit korrekten Versandkosten
    const result = await pool.request()
      .input('kKunde', sql.Int, kKunde)
      .input('vonDatum', sql.Date, vonDatum)
      .input('bisDatum', sql.Date, bisDatum)
      .query(`
        USE ${dbName};
        
        WITH Versandkosten (Artikelnummer, kArtikel, Artikelname, Versandart, kVersandart, VKNetto, EKNetto,Startgewicht, Endgewicht, Land, BasisVK, BasisEK) AS
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
        LEFT JOIN
            (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 326
            ) AS Startgewicht ON Startgewicht.kArtikel = dbo.tArtikel.kArtikel
        LEFT JOIN
            (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 327
            ) AS Endgewicht ON Endgewicht.kArtikel = dbo.tArtikel.kArtikel
        LEFT JOIN
            (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.cWertVarchar
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 328
            ) AS ISOCODE ON ISOCODE.kArtikel = dbo.tArtikel.kArtikel
        LEFT JOIN
            (
            SELECT dbo.tArtikel.kArtikel, dbo.tArtikelAttributSprache.fWertDecimal
            FROM dbo.tArtikelAttribut
            JOIN dbo.tArtikel ON dbo.tArtikel.kArtikel = dbo.tArtikelAttribut.kArtikel
            JOIN dbo.tArtikelAttributSprache ON dbo.tArtikelAttributSprache.kArtikelAttribut = dbo.tArtikelAttribut.kArtikelAttribut
            WHERE dbo.tArtikelAttribut.kAttribut = 329
            ) AS BasisVK ON BasisVK.kArtikel = dbo.tArtikel.kArtikel
        LEFT JOIN
            (
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

        Berechnungsdaten (Kundennummer, Kundenname, Lieferanschriftfirma, LieferanschriftVorname, LieferanschriftName, LieferanschriftStraße, LieferanschriftOrt,Lieferland,Auftragsnummer, externeAuftragsnummer, Erstelldatum, Lieferscheinnummer, Versanddatum, ErsterArtikel, Sendungsnummer, Gewicht, Karton, Kartonbreite, Kartonhöhe, Kartonlänge, Kartonpreis, AnzahlPicks, KostenPicks, KostenPicksRabatt, Versandart, VKKosten,EKKosten,EKKostenDHL) AS
        (
        SELECT
        ${dbName}.dbo.tkunde.cKundenNr AS 'Kundennummer',
        ${dbName}.dbo.tAdresse.cFirma AS 'Kundenname',
        Lieferadresse.cFirma AS 'Lieferanschrift Firma',
        Lieferadresse.cVorname AS 'Lieferanschrift Vorname',
        Lieferadresse.cName AS 'Lieferanschrift Name',
        Lieferadresse.cStrasse AS 'Lieferanschrift Straße',
        Lieferadresse.cOrt AS 'Lieferanschrift Ort',
        Lieferadresse.cLand AS Lieferland,
        ${dbName}.Verkauf.tAuftrag.cAuftragsNr AS 'Auftragsnummer',
        ${dbName}.Verkauf.tAuftrag.cExterneAuftragsnummer AS 'externe Auftragsnummer',
        ${dbName}.Verkauf.tAuftrag.dErstellt AS 'Erstelldatum',
        ${dbName}.dbo.tLieferschein.cLieferscheinNr AS 'Lieferscheinnummer',
        Versand.dVersendet AS 'Versanddatum',
        Bestellposition.cName AS 'Erster Artikel',
        Versand.cIdentCode AS 'Sendungsnummer',
        Versand.fgewicht AS 'Gewicht',
        CASE WHEN Karton.cName IS NULL THEN 'Kein Karton hinterlegt' ELSE Karton.cName END AS Karton,
        CASE WHEN Karton.fBreite IS NULL THEN 0 ELSE Karton.fBreite END AS KartonBreite,
        CASE WHEN Karton.fHoehe IS NULL THEN 0 ELSE Karton.fHoehe END AS Kartonhöhe,
        CASE WHEN Karton.fLaenge IS NULL THEN 0 ELSE Karton.fLaenge END AS Kartonlänge,
        CASE WHEN Karton.fEKNetto IS NULL THEN 0 ELSE CAST(Karton.fEKNetto AS decimal (10,2)) END AS [Einkaufspreis Karton],
        CAST(SUM(${dbName}.dbo.tLieferscheinPos.fAnzahl)-1 AS decimal (10,2)) AS 'Anzahl Picks',
        CAST(SUM(${dbName}.dbo.tLieferscheinPos.fAnzahl)-1  AS decimal (10,2)) * 0.25 AS 'Kosten zusätzlicher Pick',
        CAST(SUM(${dbName}.dbo.tLieferscheinPos.fAnzahl)-1  AS decimal (10,2)) * KostenPicksRabatt.dNettoPreis AS 'KostenPickRabatt',
        ${dbName}.dbo.tversandart.cname AS 'Versandart',
                CASE WHEN Versandkosten.Artikelname IS NULL 
                    THEN ((SELECT dNettoPreis FROM [dbo].[ifGetNetPrice](International.kArtikel, Verkauf.tAuftrag.kKunde, dbo.tkunde.kKundenGruppe, 0, 0))) 
                    ELSE (SELECT dNettoPreis FROM [dbo].[ifGetNetPrice](Versandkosten.kArtikel, Verkauf.tAuftrag.kKunde, dbo.tkunde.kKundenGruppe, 0, 0)) 
                END AS 'Versandkosten',
        CASE WHEN Versandkosten.Artikelname IS NULL 
                    THEN International.EKNetto
                    ELSE Versandkosten.EKNetto
                END AS 'EK-Versandkosten',
        DHLEKKosten.fWertDecimal AS 'EKKostenDHL'
        FROM ${dbName}.dbo.tLieferscheinPos
        JOIN ${dbName}.dbo.tLieferschein ON ${dbName}.dbo.tLieferschein.kLieferschein = ${dbName}.dbo.tLieferscheinPos.kLieferschein
        JOIN ${dbName}.Verkauf.tAuftragPosition ON ${dbName}.Verkauf.tAuftragPosition.kAuftragPosition = ${dbName}.dbo.tLieferscheinPos.kBestellPos
        JOIN ${dbName}.Verkauf.tAuftrag ON ${dbName}.Verkauf.tAuftrag.kAuftrag = ${dbName}.Verkauf.tAuftragPosition.kAuftrag
        LEFT JOIN 
        (
        SELECT 
        ${dbName}.Verkauf.tAuftragAttribut.kAuftrag,
        ${dbName}.Verkauf.tAuftragAttributSprache.fWertDecimal
        FROM ${dbName}.Verkauf.tAuftragAttribut
        JOIN ${dbName}.Verkauf.tAuftragAttributSprache ON ${dbName}.Verkauf.tAuftragAttributSprache.kAuftragAttribut = ${dbName}.Verkauf.tAuftragAttribut.kAuftragAttribut
        WHERE ${dbName}.Verkauf.tAuftragAttribut.kAttribut = 381
        ) AS DHLEKKosten ON DHLEKKosten.kAuftrag = ${dbName}.Verkauf.tAuftrag.kAuftrag
        JOIN (SELECT * FROM ${dbName}.Verkauf.tAuftragAdresse WHERE ${dbName}.Verkauf.tAuftragAdresse.nTyp = 0) AS Lieferadresse ON Lieferadresse.kAuftrag = ${dbName}.Verkauf.tAuftrag.kAuftrag
        LEFT JOIN ${dbName}.Verkauf.tAuftragText ON ${dbName}.Verkauf.tAuftragText.kAuftrag = ${dbName}.Verkauf.tAuftrag.kAuftrag
        JOIN ${dbName}.dbo.tAdresse ON ${dbName}.dbo.tAdresse.kKunde = ${dbName}.Verkauf.tAuftrag.kKunde
        JOIN ${dbName}.dbo.tkunde ON ${dbName}.dbo.tkunde.kKunde = ${dbName}.dbo.tAdresse.kKunde
        JOIN 
        (
        SELECT ${dbName}.dbo.tversand.kversand, ${dbName}.dbo.tVersand.kLieferschein, CAST(${dbName}.dbo.tVersand.dVersendet AS DATE) AS dVersendet, ${dbName}.dbo.tVersand.cIdentCode, ${dbName}.dbo.tVersand.kVersandArt, ${dbName}.dbo.tVersand.fGewicht FROM ${dbName}.dbo.tVersand
        GROUP BY  ${dbName}.dbo.tversand.kversand, ${dbName}.dbo.tVersand.kLieferschein, CAST(${dbName}.dbo.tVersand.dVersendet AS DATE), ${dbName}.dbo.tVersand.cIdentCode, ${dbName}.dbo.tVersand.kVersandArt, ${dbName}.dbo.tVersand.fGewicht 
        ) AS Versand ON Versand.kLieferschein = ${dbName}.dbo.tLieferschein.kLieferschein
        JOIN ${dbName}.dbo.tversandart ON ${dbName}.dbo.tversandart.kVersandArt = Versand.kVersandArt
        LEFT JOIN Versandkosten ON Versandkosten.kVersandart = Versand.kVersandArt AND CASE WHEN Versand.fGewicht < 0 THEN 1  WHEN Versand.fGewicht > 35 THEN 35 ELSE Versand.fGewicht END BETWEEN Versandkosten.Startgewicht AND Versandkosten.Endgewicht
        LEFT JOIN 
            (
                SELECT * 
                FROM Versandkosten
                WHERE Versandkosten.Land <> 'DE'
            ) AS International 
            ON International.kVersandart = Versand.kVersandArt 
               AND International.Land = Lieferadresse.ciso
               AND ISNUMERIC(
                       LTRIM(RTRIM(
                           SUBSTRING(
                               International.Artikelname, 
                               PATINDEX('%[0-9]%', International.Artikelname), 
                               CASE 
                                   WHEN PATINDEX('% kg%', International.Artikelname) > PATINDEX('%[0-9]%', International.Artikelname)
                                   THEN PATINDEX('% kg%', International.Artikelname) - PATINDEX('%[0-9]%', International.Artikelname)
                                   ELSE 0
                               END
                           )
                       ))
                   ) = 1  
               AND TRY_CAST(
                       LTRIM(RTRIM(
                           SUBSTRING(
                               International.Artikelname, 
                               PATINDEX('%[0-9]%', International.Artikelname), 
                               CASE 
                                   WHEN PATINDEX('% kg%', International.Artikelname) > PATINDEX('%[0-9]%', International.Artikelname)
                                   THEN PATINDEX('% kg%', International.Artikelname) - PATINDEX('%[0-9]%', International.Artikelname)
                                   ELSE 0
                               END
                           )
                       )) AS DECIMAL(10, 0)
                   ) = TRY_CAST(CASE WHEN Versand.fGewicht < 1 THEN 1 ELSE Versand.fGewicht END  AS DECIMAL(10, 0))
        JOIN (SELECT cName,
                    kAuftrag,
                    ROW_NUMBER() OVER (PARTITION BY kAuftrag ORDER BY nSort) AS Nummer
                FROM ${dbName}.Verkauf.tAuftragposition
            ) AS Bestellposition ON Bestellposition.kAuftrag = ${dbName}.Verkauf.tAuftrag.kAuftrag
                                AND Nummer = 1
        LEFT JOIN (
        SELECT ${dbName}.dbo.tversand.kVersand, ${dbName}.dbo.tversand.kKartonAuftragPos,  ${dbName}.Verkauf.tAuftrag.cAuftragsNr, ${dbName}.dbo.tArtikelBeschreibung.cName, ${dbName}.dbo.tartikel.fEKNetto, ${dbName}.dbo.tartikel.fBreite, ${dbName}.dbo.tartikel.fHoehe, ${dbName}.dbo.tartikel.fLaenge FROM ${dbName}.dbo.tVersand
        JOIN ${dbName}.dbo.tLieferschein ON ${dbName}.dbo.tlieferschein.kLieferschein = ${dbName}.dbo.tversand.kLieferschein
        JOIN ${dbName}.Verkauf.tAuftrag ON ${dbName}.Verkauf.tAuftrag.kAuftrag = ${dbName}.dbo.tlieferschein.kBestellung
        JOIN ${dbName}.Verkauf.tAuftragPosition ON ${dbName}.Verkauf.tAuftragPosition.kAuftragPosition = ${dbName}.dbo.tVersand.kKartonAuftragPos
        JOIN ${dbName}.dbo.tKartonVersandArtMapping ON ${dbName}.dbo.tKartonVersandArtMapping.kArtikel = ${dbName}.Verkauf.tAuftragPosition.kArtikel
        JOIN ${dbName}.dbo.tArtikel ON ${dbName}.dbo.tArtikel.kArtikel = ${dbName}.Verkauf.tAuftragPosition.kArtikel
        JOIN ${dbName}.dbo.tArtikelBeschreibung ON ${dbName}.dbo.tArtikelBeschreibung.kArtikel = ${dbName}.Verkauf.tAuftragPosition.kArtikel
        WHERE CAST(tVersand.dVersendet AS DATE) >= @vonDatum AND CAST(tVersand.dVersendet AS DATE) <= @bisDatum AND ${dbName}.Verkauf.tAuftragPosition.nType = 15 AND ${dbName}.dbo.tArtikelBeschreibung.kSprache = 1 AND ${dbName}.dbo.tArtikelBeschreibung.kPlattform = 1
        GROUP BY  ${dbName}.dbo.tversand.kVersand, ${dbName}.dbo.tversand.kKartonAuftragPos,  ${dbName}.Verkauf.tAuftrag.cAuftragsNr, ${dbName}.dbo.tArtikelBeschreibung.cName, ${dbName}.dbo.tartikel.fEKNetto, ${dbName}.dbo.tartikel.fLaenge, ${dbName}.dbo.tartikel.fBreite, ${dbName}.dbo.tartikel.fHoehe
        ) AS Karton ON Karton.kVersand = Versand.kVersand
        JOIN 
        (
        SELECT
            Kunde.kKunde,
            p.dNettoPreis,
            p.dRabatt
        FROM
            ${dbName}.dbo.tkunde Kunde
        cross apply
            ${dbName}.[dbo].[ifGetNetPrice] (5398, Kunde.kKunde, Kunde.kKundenGruppe, 0, 1) p

        ) AS KostenPicksRabatt ON KostenPicksRabatt.kKunde = ${dbName}.Verkauf.tAuftrag.kKunde
        WHERE ${dbName}.Verkauf.tAuftragPosition.nType = 1 AND ${dbName}.Verkauf.tAuftragPosition.kAuftragPosition <> ${dbName}.Verkauf.tAuftragPosition.kAuftragStueckliste  AND Versand.dVersendet BETWEEN @vonDatum AND @bisDatum AND ${dbName}.dbo.tAdresse.nTyp = 1 AND ${dbName}.dbo.tAdresse.nStandard = 1 AND ${dbName}.Verkauf.tAuftrag.kKunde = @kKunde
        OR ${dbName}.Verkauf.tAuftragPosition.kAuftragStueckliste IS NULL AND ${dbName}.Verkauf.tAuftragPosition.nType = 1 AND Versand.dVersendet BETWEEN @vonDatum AND @bisDatum  AND ${dbName}.dbo.tAdresse.nTyp = 1 AND ${dbName}.dbo.tAdresse.nStandard = 1 AND ${dbName}.Verkauf.tAuftrag.kKunde = @kKunde
        GROUP BY Lieferadresse.cStrasse, Lieferadresse.cOrt, Lieferadresse.cVorname, Lieferadresse.cName, Lieferadresse.cFirma,${dbName}.dbo.tkunde.cKundenNr, ${dbName}.dbo.tAdresse.cFirma, ${dbName}.Verkauf.tAuftrag.cExterneAuftragsnummer, ${dbName}.Verkauf.tAuftrag.dErstellt ,${dbName}.Verkauf.tAuftragText.cAnmerkung, ${dbName}.dbo.tLieferschein.cLieferscheinNr, Lieferadresse.cLand, Versand.dVersendet, Bestellposition.cName, Versand.cIdentCode, Karton.cName, Karton.fEKNetto, Lieferadresse.cISO, Versand.fGewicht,  ${dbName}.Verkauf.tAuftrag.cAuftragsNr, ${dbName}.dbo.tversandart.cname ,KostenPicksRabatt.dNettoPreis, International.kArtikel, Versandkosten.BasisVK, ${dbName}.Verkauf.tAuftrag.kKunde, Versandkosten.Artikelname, International.BasisVK, ${dbName}.dbo.tkunde.kKundenGruppe, Versandkosten.kArtikel,International.EKNetto,Versandkosten.EKNetto, DHLEKKosten.fWertDecimal, Karton.fBreite, Karton.fHoehe, Karton.fLaenge
        ),

        Berechnunguebersicht (Kundennummer, Kundenname, LSFirma, LSVorname,LSName,LSStraße, LSOrt, Lieferland, Erstelldatum, Auftragsnummer, externeAuftragsnummer, ErsterArtikel, Lieferscheinnummer, Versanddatum, Sendungsnummer, Gewicht, Karton, Kartonbreite, Kartonhöhe, Kartonlänge, Kartonpreis, Versandart, AnzahlPicks, KostenPicksRabatt, AnzahlPaket, VKKosten,EKKosten,EKKostenDHL) AS
        (
        SELECT 
        Kundennummer,
        Kundenname,
        Lieferanschriftfirma ,
        LieferanschriftVorname ,
        LieferanschriftName,
        LieferanschriftStraße,
        LieferanschriftOrt ,
        Lieferland,
        Erstelldatum,
        Auftragsnummer,
        externeAuftragsnummer,
        ErsterArtikel,
        Lieferscheinnummer, 
        Versanddatum,
        Sendungsnummer, 
        CAST(Gewicht AS DECIMAL (10,2)) AS 'Gewicht',
        Karton,
        Kartonbreite,
        Kartonhöhe,
        Kartonlänge,
        Kartonpreis,
        Versandart,
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) > 1 THEN 0 ELSE AnzahlPicks END AS 'AnzahlPicks', 
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) > 1 THEN 0 ELSE KostenPicksRabatt END AS 'KostenPicksRabatt', 
        ROW_NUMBER() OVER (PARTITION BY Lieferscheinnummer ORDER BY Lieferscheinnummer) AS 'AnzahlPaket', 
        VKKosten  AS 'VKKosten',
        EKKosten,
        EKKostenDHL
        FROM Berechnungsdaten
        )

        SELECT 
          Kundennummer,
          Kundenname,
          LSFirma,
          LSVorname,
          LSName,
          LSStraße,
          LSOrt,
          Lieferland,
          Erstelldatum,
          Auftragsnummer,
          externeAuftragsnummer,
          ErsterArtikel,
          Lieferscheinnummer,
          Versanddatum,
          Sendungsnummer,
          Gewicht,
          Karton,
          Kartonbreite,
          Kartonhöhe,
          Kartonlänge,
          Kartonpreis,
          Versandart,
          AnzahlPicks,
          KostenPicksRabatt,
          AnzahlPaket,
          VKKosten
        FROM Berechnunguebersicht
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