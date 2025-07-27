import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertCircle, Calendar } from 'lucide-react';
import { dashboardAPI } from '../services/api';
import './ItemizedRecords.css';

const ItemizedRecords = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadRecords();
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    try {
      const response = await dashboardAPI.getAvailableMonths();
      setAvailableMonths(response.data);
      
      // Automatisch den aktuellen Monat auswählen
      if (response.data.length > 0) {
        setSelectedMonth(response.data[0].value);
      }
    } catch (err) {
      console.error('Fehler beim Laden der verfügbaren Monate:', err);
      setError('Fehler beim Laden der verfügbaren Monate');
    }
  };

  const loadRecords = async () => {
    if (!selectedMonth) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await dashboardAPI.getItemizedRecords(selectedMonth);
      setRecords(response.data.records || []);
      setSummary(response.data.summary || null);
    } catch (err) {
      console.error('Fehler beim Laden der Einzelverbindungsnachweise:', err);
      setError(err.response?.data?.details || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) return;

    // CSV Header definieren
    const headers = [
      'Kundennummer',
      'Kundenname', 
      'LSFirma',
      'LSVorname',
      'LSName',
      'LSStraße',
      'LSOrt',
      'Lieferland',
      'Erstelldatum',
      'Auftragsnummer',
      'ExterneAuftragsnummer',
      'ErsterArtikel',
      'Lieferscheinnummer',
      'Versanddatum',
      'Sendungsnummer',
      'Gewicht',
      'Karton',
      'Kartonbreite',
      'Kartonhöhe',
      'Kartonlänge',
      'Kartonpreis',
      'Versandart',
      'AnzahlPicks',
      'KostenPicksRabatt',
      'AnzahlPaket',
      'VKKosten',
      'EKKosten',
      'EKKostenDHL',
      'FehlerEKKostenDHL'
    ];

    // CSV Content erstellen
    const csvContent = [
      headers.join(','),
      ...records.map(record => 
        headers.map(header => {
          const value = record[header] || '';
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    // Download auslösen
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `einzelverbindungsnachweis_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(numValue);
  };

  const formatNumber = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('de-DE').format(numValue);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  };

  const renderSummary = () => {
    if (!summary) return null;

    return (
      <div className="summary-container">
        <h3>Zusammenfassung</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Gesamtgewicht</div>
            <div className="summary-value">{formatNumber(summary.total.weight)} kg</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Picks gesamt</div>
            <div className="summary-value">{formatNumber(summary.total.picks)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Kosten gesamt</div>
            <div className="summary-value">{formatCurrency(summary.total.cost)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Pakete gesamt</div>
            <div className="summary-value">{formatNumber(summary.total.packages)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderCarrierBreakdown = () => {
    if (!summary?.byCarrier || Object.keys(summary.byCarrier).length === 0) return null;

    return (
      <div className="carrier-breakdown">
        <h3>Aufschlüsselung nach Versanddienstleister</h3>
        <div className="carrier-grid">
          {Object.entries(summary.byCarrier).map(([carrier, data]) => (
            <div key={carrier} className="carrier-card">
              <div className="carrier-name">{carrier}</div>
              <div className="carrier-stats">
                <div>Sendungen: {formatNumber(data.count)}</div>
                <div>Pakete: {formatNumber(data.packages)}</div>
                <div>Kosten: {formatCurrency(data.cost)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="itemized-records">
      {/* Header mit Controls */}
      <div className="page-header">
        <h1>Einzelverbindungsnachweis</h1>
        <div className="page-actions">
          <div className="month-selector-wrapper">
            <Calendar size={16} className="calendar-icon" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-selector"
              disabled={loading}
            >
              <option value="">Monat auswählen</option>
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label} ({month.count} Sendungen)
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={loadRecords} 
            disabled={loading || !selectedMonth}
            className={`action-button refresh-button ${loading ? 'loading' : ''}`}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Aktualisieren
          </button>
          
          <button 
            onClick={exportToCSV} 
            disabled={records.length === 0}
            className="action-button export-button"
          >
            <Download size={16} />
            CSV Export
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <div>
            <p>{error}</p>
            <button onClick={() => loadRecords()}>Erneut versuchen</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <RefreshCw className="loading-spinner" />
          <p>Lade Daten...</p>
        </div>
      )}

      {!loading && !error && selectedMonth && (
        <>
          {renderSummary()}
          {renderCarrierBreakdown()}
          
          {records.length > 0 && (
            <div className="records-table-container">
              <h3>Detailaufstellung ({records.length} Einträge)</h3>
              <div className="table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Lieferung</th>
                      <th>Auftrag</th>
                      <th>Sendung</th>
                      <th>Karton & Kosten</th>
                      <th>Versand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={index}>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.LSVorname} {record.LSName}</strong>
                            </div>
                            <div className="cell-sub">{record.LSFirma}</div>
                            <div className="cell-sub">{record.LSStraße}, {record.LSOrt}</div>
                            <div className="cell-sub">{record.Lieferland}</div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Auftragsnummer}</strong>
                            </div>
                            <div className="cell-sub">
                              {record.externeAuftragsnummer && `Ext: ${record.externeAuftragsnummer}`}
                            </div>
                            <div className="cell-sub">
                              Erstellt: {formatDate(record.Erstelldatum)}
                            </div>
                            <div className="cell-sub">
                              LS: {record.Lieferscheinnummer}
                            </div>
                            <div className="cell-sub">
                              Artikel: {record.ErsterArtikel}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Sendungsnummer || 'Keine Sendungsnummer'}</strong>
                            </div>
                            <div className="cell-sub">
                              Versendet: {formatDate(record.Versanddatum)}
                            </div>
                            <div className="cell-sub">
                              Gewicht: {formatNumber(record.Gewicht)} kg
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Karton}</strong>
                            </div>
                            <div className="cell-sub">
                              {record.Kartonbreite}×{record.Kartonhöhe}×{record.Kartonlänge} cm
                            </div>
                            <div className="cell-sub">
                              Karton: {formatCurrency(record.Kartonpreis)}
                            </div>
                            <div className="cell-sub">
                              Picks: {formatNumber(record.AnzahlPicks)}
                            </div>
                            <div className="cell-sub">
                              Pick-Kosten: {formatCurrency(record.KostenPicksRabatt)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Versandart}</strong>
                            </div>
                            <div className="cell-sub">
                              VK: {formatCurrency(record.VKKosten)}
                            </div>
                            <div className="cell-sub">
                              EK: {formatCurrency(record.EKKosten)}
                            </div>
                            <div className="cell-sub">
                              DHL-EK: {formatCurrency(record.EKKostenDHL)}
                            </div>
                            {record.FehlerEKKostenDHL === 'X' && (
                              <div className="cell-error">
                                <AlertCircle size={14} />
                                EK-Fehler
                              </div>
                            )}
                            <div className="cell-sub">
                              Pakete: {formatNumber(record.AnzahlPaket)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && records.length === 0 && selectedMonth && (
            <div className="no-data">
              <p>Keine Daten für den ausgewählten Monat gefunden.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ItemizedRecords;