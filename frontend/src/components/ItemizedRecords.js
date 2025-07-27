import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Download, 
  RefreshCw, 
  Package, 
  Scale, 
  DollarSign, 
  Truck,
  Archive
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import './ItemizedRecords.css';

const ItemizedRecords = () => {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  const loadAvailableMonths = async () => {
    try {
      const response = await dashboardAPI.getAvailableMonths();
      setAvailableMonths(response.data);
      
      // Automatisch aktuellen Monat auswählen
      if (response.data.length > 0) {
        const currentMonth = response.data[0].value;
        setSelectedMonth(currentMonth);
        loadRecords(currentMonth);
      }
    } catch (err) {
      console.error('Fehler beim Laden der verfügbaren Monate:', err);
      setError('Fehler beim Laden der verfügbaren Monate');
    }
  };

  const loadRecords = async (month = selectedMonth) => {
    if (!month) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await dashboardAPI.getItemizedRecords(month);
      setRecords(response.data.records || []);
      setSummary(response.data.summary || {});
      
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden des Einzelverbindungsnachweises');
      setRecords([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    loadRecords(month);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('de-DE').format(value || 0);
  };

  const formatWeight = (value) => {
    if (!value) return '0 kg';
    return value < 1 ? `${(value * 1000).toFixed(0)} g` : `${value.toFixed(2)} kg`;
  };

  const exportToCSV = () => {
    if (records.length === 0) return;
    
    const headers = [
      'LSVorname',
      'LSName', 
      'Lieferland',
      'Erstelldatum',
      'Auftragsnummer',
      'ExterneAuftragsnummer',
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
      'AnzahlPaket',
      'VKKosten'
    ];
    
    const csvContent = [
      headers.join(';'),
      ...records.map(record => [
        record.LSVorname || '',
        record.LSName || '',
        record.Lieferland || '',
        record.Erstelldatum ? new Date(record.Erstelldatum).toLocaleDateString('de-DE') : '',
        record.Auftragsnummer || '',
        record.ExterneAuftragsnummer || '',
        record.Versanddatum ? new Date(record.Versanddatum).toLocaleDateString('de-DE') : '',
        record.Sendungsnummer || '',
        (record.Gewicht || 0).toString().replace('.', ','),
        record.Karton || '',
        (record.Kartonbreite || 0).toString().replace('.', ','),
        (record.Kartonhöhe || 0).toString().replace('.', ','),
        (record.Kartonlänge || 0).toString().replace('.', ','),
        (record.Kartonpreis || 0).toString().replace('.', ','),
        record.Versandart || '',
        record.AnzahlPicks || 0,
        record.AnzahlPaket || 0,
        (record.VKKosten || 0).toString().replace('.', ',')
      ].join(';'))
    ].join('\n');
    
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

  const renderSummary = () => {
    if (!summary.total) return null;

    return (
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon weight">
            <Scale size={20} />
          </div>
          <div className="summary-content">
            <h3>Gesamtgewicht</h3>
            <p className="summary-value">{formatWeight(summary.total.weight)}</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon picks">
            <Package size={20} />
          </div>
          <div className="summary-content">
            <h3>Versendete Artikel</h3>
            <p className="summary-value">{formatNumber(summary.total.picks)}</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon cost">
            <DollarSign size={20} />
          </div>
          <div className="summary-content">
            <h3>Versandkosten</h3>
            <p className="summary-value">{formatCurrency(summary.total.cost)}</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon boxes">
            <Archive size={20} />
          </div>
          <div className="summary-content">
            <h3>Pakete</h3>
            <p className="summary-value">{formatNumber(summary.total.packages)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderCarrierBreakdown = () => {
    if (!summary.byCarrier || Object.keys(summary.byCarrier).length === 0) return null;

    return (
      <div className="carrier-breakdown">
        <h3>Aufschlüsselung nach Versanddienstleister</h3>
        <div className="carrier-grid">
          {Object.entries(summary.byCarrier).map(([carrier, data]) => (
            <div key={carrier} className="carrier-card">
              <div className="carrier-header">
                <Truck size={16} />
                <h4>{carrier}</h4>
              </div>
              <div className="carrier-stats">
                <div className="stat">
                  <span className="label">Sendungen:</span>
                  <span className="value">{formatNumber(data.count)}</span>
                </div>
                <div className="stat">
                  <span className="label">Kosten:</span>
                  <span className="value">{formatCurrency(data.cost)}</span>
                </div>
                <div className="stat">
                  <span className="label">Pakete:</span>
                  <span className="value">{formatNumber(data.packages)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="itemized-records">
      <div className="records-header">
        <h2>Einzelverbindungsnachweis</h2>
        
        <div className="header-controls">
          <div className="month-selector">
            <Calendar size={16} />
            <select 
              value={selectedMonth} 
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={loading}
            >
              <option value="">Monat auswählen...</option>
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label} ({month.count} Sendungen)
                </option>
              ))}
            </select>
          </div>
          
          <div className="action-buttons">
            <button 
              onClick={() => loadRecords()} 
              disabled={loading || !selectedMonth}
              className="refresh-button"
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              Aktualisieren
            </button>
            
            <button 
              onClick={exportToCSV} 
              disabled={records.length === 0}
              className="export-button"
            >
              <Download size={16} />
              CSV Export
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => loadRecords()}>Erneut versuchen</button>
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
                            <div className="cell-sub">{record.Lieferland}</div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Auftragsnummer}</strong>
                            </div>
                            <div className="cell-sub">
                              {record.ExterneAuftragsnummer && `Ext: ${record.ExterneAuftragsnummer}`}
                            </div>
                            <div className="cell-sub">
                              Erstellt: {record.Erstelldatum ? new Date(record.Erstelldatum).toLocaleDateString('de-DE') : ''}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Sendungsnummer}</strong>
                            </div>
                            <div className="cell-sub">
                              Versandt: {record.Versanddatum ? new Date(record.Versanddatum).toLocaleDateString('de-DE') : ''}
                            </div>
                            <div className="cell-sub">
                              Gewicht: {formatWeight(record.Gewicht)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Karton}</strong>
                            </div>
                            <div className="cell-sub">
                              Preis: {formatCurrency(record.Kartonpreis)}
                            </div>
                            <div className="cell-sub">
                              Picks: {formatNumber(record.AnzahlPicks)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="cell-content">
                            <div className="cell-main">
                              <strong>{record.Versandart}</strong>
                            </div>
                            <div className="cell-sub">
                              Pakete: {formatNumber(record.AnzahlPaket)}
                            </div>
                            <div className="cell-main currency">
                              {formatCurrency(record.VKKosten)}
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
          
          {records.length === 0 && !loading && selectedMonth && (
            <div className="no-data">
              <Package size={48} />
              <h3>Keine Daten verfügbar</h3>
              <p>Für den ausgewählten Monat wurden keine Versanddaten gefunden.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ItemizedRecords;