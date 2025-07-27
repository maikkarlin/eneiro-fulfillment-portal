import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { 
  Download, Calendar, Package, Truck, 
  FileText, Loader, Filter, User, MapPin,
  ShoppingCart, Euro, Hash, Calendar as CalendarIcon,
  Send, Scale, Box
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
      currency: 'EUR',
      minimumFractionDigits: 2
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

  const formatWeight = (weight) => {
    return `${(weight || 0).toFixed(2)} kg`;
  };

  // CSV Export mit ALLEN Spalten
  const exportToCSV = () => {
    if (!data || !data.records) return;

    const headers = [
      'LSVorname', 'LSName', 'Lieferland', 'Erstelldatum', 'Auftragsnummer', 
      'ExterneAuftragsnummer', 'Versanddatum', 'Sendungsnummer', 'Gewicht',
      'Karton', 'Kartonbreite', 'Kartonhöhe', 'Kartonlänge', 'Kartonpreis', 
      'Versandart', 'AnzahlPicks', 'AnzahlPaket', 'VKKosten'
    ];

    const rows = data.records.map(r => [
      r.LSVorname || '',
      r.LSName || '',
      r.Lieferland || '',
      formatDate(r.Erstelldatum),
      r.Auftragsnummer || '',
      r.ExterneAuftragsnummer || '',
      formatDate(r.Versanddatum),
      r.Sendungsnummer || '',
      (r.Gewicht || 0).toFixed(2).replace('.', ','),
      r.Karton || '',
      (r.Kartonbreite || 0).toString().replace('.', ','),
      (r.Kartonhöhe || 0).toString().replace('.', ','),
      (r.Kartonlänge || 0).toString().replace('.', ','),
      (r.Kartonpreis || 0).toFixed(2).replace('.', ','),
      r.Versandart || '',
      (r.AnzahlPicks || 0).toString(),
      (r.AnzahlPaket || 0).toString(),
      (r.VKKosten || 0).toFixed(2).replace('.', ',')
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
              <div className="table-scroll">
                <table className="records-table compact">
                  <thead>
                    <tr>
                      <th className="customer-info">
                        <User size={16} />
                        Empfänger
                      </th>
                      <th className="location">
                        <MapPin size={16} />
                        Land
                      </th>
                      <th className="date">
                        <CalendarIcon size={16} />
                        Erstellt
                      </th>
                      <th className="order-info">
                        <ShoppingCart size={16} />
                        Aufträge
                      </th>
                      <th className="shipping-date">
                        <Send size={16} />
                        Versandt
                      </th>
                      <th className="tracking">
                        <Hash size={16} />
                        Sendung
                      </th>
                      <th className="weight">
                        <Scale size={16} />
                        Gewicht
                      </th>
                      <th className="box-info">
                        <Box size={16} />
                        Karton
                      </th>
                      <th className="shipping-method">
                        <Truck size={16} />
                        Versandart
                      </th>
                      <th className="picks">
                        Picks
                      </th>
                      <th className="packages">
                        Pakete
                      </th>
                      <th className="cost">
                        <Euro size={16} />
                        Kosten
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((record, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'even' : 'odd'}>
                        <td className="customer-info">
                          <div className="customer-name">
                            <strong>{record.LSVorname} {record.LSName}</strong>
                            {record.LSFirma && record.LSFirma !== 'NULL' && (
                              <div className="company-name">{record.LSFirma}</div>
                            )}
                          </div>
                        </td>
                        <td className="location">
                          <span className="country-badge">{record.Lieferland}</span>
                        </td>
                        <td className="date">
                          <div className="date-info">
                            <div className="date-primary">{formatDate(record.Erstelldatum)}</div>
                            <div className="time-secondary">{formatTime(record.Erstelldatum)}</div>
                          </div>
                        </td>
                        <td className="order-info">
                          <div className="order-numbers">
                            <div className="order-primary">{record.Auftragsnummer}</div>
                            {record.ExterneAuftragsnummer && (
                              <div className="order-secondary">{record.ExterneAuftragsnummer}</div>
                            )}
                          </div>
                        </td>
                        <td className="shipping-date">
                          <div className="date-primary">{formatDate(record.Versanddatum)}</div>
                        </td>
                        <td className="tracking">
                          <div className="tracking-number">{record.Sendungsnummer || '-'}</div>
                        </td>
                        <td className="weight">
                          <span className="weight-value">{formatWeight(record.Gewicht)}</span>
                        </td>
                        <td className="box-info">
                          <div className="box-details">
                            <div className="box-name">{record.Karton}</div>
                            <div className="box-price">{formatCurrency(record.Kartonpreis)}</div>
                          </div>
                        </td>
                        <td className="shipping-method">
                          <span className="carrier-badge">
                            <Truck size={14} />
                            {record.Versandart}
                          </span>
                        </td>
                        <td className="picks text-center">
                          <span className="picks-count">{record.AnzahlPicks || 0}</span>
                        </td>
                        <td className="packages text-center">
                          <span className="package-count">{record.AnzahlPaket || 0}</span>
                        </td>
                        <td className="cost">
                          <span className="cost-value">{formatCurrency(record.VKKosten)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'summary' && data && (
            <div className="summary-container">
              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-icon packages">
                    <Package />
                  </div>
                  <div className="summary-content">
                    <h3>Gesamtanzahl Pakete</h3>
                    <p className="summary-value">{data.summary.totalPackages}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon weight">
                    <Scale />
                  </div>
                  <div className="summary-content">
                    <h3>Gesamtgewicht</h3>
                    <p className="summary-value">{formatWeight(data.summary.totalWeight)}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon picks">
                    <Box />
                  </div>
                  <div className="summary-content">
                    <h3>Gesamtanzahl Picks</h3>
                    <p className="summary-value">{data.summary.totalPicks}</p>
                    <p className="summary-sub">{formatCurrency(data.summary.totalPickCosts)} Kosten</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon cost">
                    <Euro />
                  </div>
                  <div className="summary-content">
                    <h3>Versandkosten gesamt</h3>
                    <p className="summary-value">{formatCurrency(data.summary.totalCost)}</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon boxes">
                    <Package />
                  </div>
                  <div className="summary-content">
                    <h3>Kartonkosten gesamt</h3>
                    <p className="summary-value">{formatCurrency(data.summary.totalBoxCosts)}</p>
                  </div>
                </div>
              </div>

              <div className="carrier-breakdown">
                <h3>Verteilung nach Versanddienstleister</h3>
                <div className="carrier-grid">
                  {Object.entries(data.summary.byCarrier).map(([carrier, stats]) => (
                    <div key={carrier} className="carrier-card">
                      <div className="carrier-header">
                        <Truck size={20} />
                        <h4>{carrier}</h4>
                      </div>
                      <div className="carrier-stats">
                        <div className="stat">
                          <span className="label">Sendungen:</span>
                          <span className="value">{stats.count}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Pakete:</span>
                          <span className="value">{stats.packages}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Kosten:</span>
                          <span className="value">{formatCurrency(stats.cost)}</span>
                        </div>
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