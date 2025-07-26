import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { 
  Download, Calendar, Package, Truck, 
  FileText, Loader, Filter
} from 'lucide-react';
import './ItemizedRecords.css';

function ItemizedRecords() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [activeTab, setActiveTab] = useState('table');

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth || availableMonths.length > 0) {
      loadItemizedRecords();
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    try {
      const response = await dashboardAPI.getAvailableMonths();
      setAvailableMonths(response.data);
      if (response.data.length > 0 && !selectedMonth) {
        setSelectedMonth(response.data[0].value);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Monate:', error);
    }
  };

  const loadItemizedRecords = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getItemizedRecords(selectedMonth);
      setData(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    if (!data || !data.records) return;

    const headers = [
      'Datum', 'Uhrzeit', 'Bestellnummer', 'Tracking', 'Versanddienstleister',
      'Pakete', 'Gewicht (kg)', 'Kosten (EUR)', 'Empfänger', 'Ort', 'Land'
    ];

    const rows = data.records.map(r => [
      formatDate(r.datum),
      formatTime(r.datum),
      r.bestellNummer || '',
      r.trackingNummer || '',
      r.versanddienstleister || '',
      r.anzahlPakete || '0',
      (r.gewicht || 0).toFixed(2).replace('.', ','),
      (r.versandkosten || 0).toFixed(2).replace('.', ','),
      `${r.empfaengerName || ''} ${r.empfaengerFirma || ''}`.trim(),
      r.empfaengerOrt || '',
      r.empfaengerLand || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Einzelverbindungsnachweis_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="itemized-records">
      <div className="records-header">
        <h2>Einzelverbindungsnachweis</h2>
        
        <div className="header-controls">
          <div className="month-selector">
            <Calendar size={20} />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={loading}
            >
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label} ({month.count} Sendungen)
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className="export-button" 
            onClick={exportToCSV}
            disabled={loading || !data?.records?.length}
          >
            <Download size={20} />
            CSV Export
          </button>
        </div>
      </div>

      <div className="tab-buttons">
        <button 
          className={`tab-button ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <FileText size={18} />
          Detailansicht
        </button>
        <button 
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <Filter size={18} />
          Zusammenfassung
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <Loader className="loading-spinner" />
          <p>Daten werden geladen...</p>
        </div>
      ) : (
        <>
          {activeTab === 'table' && data && (
            <div className="records-table-container">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Uhrzeit</th>
                    <th>Bestellnr.</th>
                    <th>Tracking</th>
                    <th>Versandart</th>
                    <th>Pakete</th>
                    <th>Gewicht</th>
                    <th>Kosten</th>
                    <th>Empfänger</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record, index) => (
                    <tr key={index}>
                      <td>{formatDate(record.datum)}</td>
                      <td>{formatTime(record.datum)}</td>
                      <td className="order-number">{record.bestellNummer}</td>
                      <td className="tracking-number">{record.trackingNummer || '-'}</td>
                      <td>
                        <span className="carrier-badge">
                          <Truck size={14} />
                          {record.versanddienstleister || 'Unbekannt'}
                        </span>
                      </td>
                      <td className="text-center">{record.anzahlPakete || 0}</td>
                      <td className="text-right">{(record.gewicht || 0).toFixed(2)} kg</td>
                      <td className="text-right cost">{formatCurrency(record.versandkosten)}</td>
                      <td>
                        <div className="recipient">
                          <div>{record.empfaengerName || record.empfaengerFirma}</div>
                          <div className="recipient-location">
                            {record.empfaengerOrt}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'summary' && data && (
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-icon">
                  <Package />
                </div>
                <div className="summary-content">
                  <h3>Gesamtanzahl Sendungen</h3>
                  <p className="summary-value">{data.summary.totalPackages}</p>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon">
                  <Truck />
                </div>
                <div className="summary-content">
                  <h3>Gesamtgewicht</h3>
                  <p className="summary-value">{data.summary.totalWeight.toFixed(2)} kg</p>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon">
                  <FileText />
                </div>
                <div className="summary-content">
                  <h3>Versandkosten gesamt</h3>
                  <p className="summary-value">{formatCurrency(data.summary.totalCost)}</p>
                </div>
              </div>

              <div className="summary-card full-width">
                <h3>Verteilung nach Versanddienstleister</h3>
                <div className="carrier-distribution">
                  {Object.entries(data.summary.byCarrier).map(([carrier, stats]) => (
                    <div key={carrier} className="carrier-row">
                      <div className="carrier-info">
                        <span className="carrier-name">{carrier}</span>
                        <span className="carrier-count">{stats.count} Sendungen</span>
                      </div>
                      <div className="carrier-cost">
                        {formatCurrency(stats.cost)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ItemizedRecords;