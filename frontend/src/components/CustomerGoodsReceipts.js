// frontend/src/components/CustomerGoodsReceipts.js
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Camera, 
  Eye,
  Search,
  Filter,
  X,
  Image
} from 'lucide-react';
import { goodsReceiptAPI } from '../services/api';
import './CustomerGoodsReceipts.css';

const CustomerGoodsReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  
  // NEU: Such- und Filter-States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [filteredReceipts, setFilteredReceipts] = useState([]);

  useEffect(() => {
    loadCustomerReceipts();
  }, []);

  // NEU: Filter-Logik
  useEffect(() => {
    if (!receipts) {
      setFilteredReceipts([]);
      return;
    }

    let filtered = [...receipts];

    // Suchfilter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.kWarenannahme.toString().includes(searchTerm) ||
        (item.cTransporteur && item.cTransporteur.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.cJTLLieferantenbestellnummer && item.cJTLLieferantenbestellnummer.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status-Filter
    if (statusFilter !== 'alle') {
      filtered = filtered.filter(item => item.cStatus === statusFilter);
    }

    setFilteredReceipts(filtered);
  }, [receipts, searchTerm, statusFilter]);

  const loadCustomerReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('📦 Lade Kunden-Warenannahmen...');
      const response = await goodsReceiptAPI.getCustomerReceipts();
      
      console.log('✅ Kunden-Warenannahmen geladen:', response.data);
      setReceipts(response.data);
      
    } catch (err) {
      console.error('❌ Fehler beim Laden der Warenannahmen:', err);
      setError('Fehler beim Laden Ihrer Warenannahmen: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Eingegangen': { icon: Clock, color: 'blue', label: 'Eingegangen' },
      'In Einlagerung': { icon: Package, color: 'orange', label: 'In Einlagerung' },
      'Eingelagert': { icon: CheckCircle, color: 'green', label: 'Eingelagert' }
    };

    const config = statusConfig[status] || { icon: AlertCircle, color: 'gray', label: status };
    const Icon = config.icon;

    return (
      <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('de-DE');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    try {
      if (!timeStr) return '-';
      
      // Wenn es ein String ist
      if (typeof timeStr === 'string') {
        // Format: "HH:MM:SS.0000000" oder "HH:MM:SS" oder "HH:MM"
        if (timeStr.includes(':')) {
          // Nimm nur die ersten 5 Zeichen (HH:MM)
          return timeStr.substring(0, 5);
        }
      }
      
      // Wenn es ein Date-Objekt ist
      if (timeStr instanceof Date) {
        const hours = timeStr.getHours().toString().padStart(2, '0');
        const minutes = timeStr.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      
      return timeStr;
    } catch (error) {
      console.error('Fehler beim Formatieren der Zeit:', error);
      return timeStr || '-';
    }
  };

  if (loading) {
    return (
      <div className="customer-receipts-container">
        <div className="loading-spinner">
          <Package size={48} />
          <p>Lade Ihre Warenannahmen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-receipts-container">
        <div className="error-card">
          <AlertCircle size={48} />
          <h3>Fehler beim Laden</h3>
          <p>{error}</p>
          <button onClick={loadCustomerReceipts} className="retry-button">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-receipts-container">
      <div className="section-header">
        <h2>Ihre Warenannahmen</h2>
        <button onClick={loadCustomerReceipts} className="refresh-button">
          🔄 Aktualisieren
        </button>
      </div>

      {/* NEU: Such- und Filterbereich */}
      <div className="search-filter-container">
        <div className="search-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Suche nach ID, Transporteur oder JTL-Nummer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-wrapper">
          <Filter size={20} className="filter-icon" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="alle">Alle Status</option>
            <option value="Eingegangen">Eingegangen</option>
            <option value="In Einlagerung">In Einlagerung</option>
            <option value="Eingelagert">Eingelagert</option>
          </select>
        </div>
      </div>
      
      {/* Ergebnisinfo */}
      {(searchTerm || statusFilter !== 'alle') && (
        <div className="filter-info">
          {filteredReceipts.length} von {receipts.length} Einträgen gefunden
        </div>
      )}

      {filteredReceipts.length === 0 ? (
        <div className="empty-state">
          <Package size={64} />
          <h3>
            {searchTerm || statusFilter !== 'alle' 
              ? 'Keine Warenannahmen gefunden' 
              : 'Keine Warenannahmen vorhanden'}
          </h3>
          <p>
            {searchTerm || statusFilter !== 'alle'
              ? 'Versuchen Sie es mit anderen Suchkriterien.'
              : 'Es wurden noch keine Lieferungen für Sie erfasst.'}
          </p>
        </div>
      ) : (
        <div className="goods-receipt-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Datum</th>
                <th>Uhrzeit</th>
                <th>Transporteur</th>
                <th>Packstücke</th>
                <th>Zustand</th>
                <th>Status</th>
                <th>JTL-Nummer</th>
                <th>Foto</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.kWarenannahme}>
                  <td className="id-cell">
                    WA-{receipt.kWarenannahme}
                  </td>
                  <td>{formatDate(receipt.dDatum)}</td>
                  <td>{formatTime(receipt.tUhrzeit)}</td>
                  <td>{receipt.cTransporteur || '-'}</td>
                  <td>
                    {receipt.nAnzahlPackstuecke}x {receipt.cPackstueckArt}
                  </td>
                  <td>
                    <span className={`zustand-badge ${receipt.cZustand === 'In Ordnung' ? 'gut' : 'beschaedigt'}`}>
                      {receipt.cZustand}
                    </span>
                  </td>
                  <td>{getStatusBadge(receipt.cStatus)}</td>
                  <td className="jtl-number">
                    {receipt.cJTLLieferantenbestellnummer || '-'}
                  </td>
                  <td>
                    {receipt.cFotoPath ? (
                      <button 
                        className="action-button photo-button"
                        onClick={() => setPhotoModal(receipt.cFotoPath)}
                        title="Foto anzeigen"
                      >
                        <Camera size={16} />
                      </button>
                    ) : (
                      <span className="no-photo">-</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="action-button details-button"
                      onClick={() => setSelectedReceipt(receipt)}
                      title="Details anzeigen"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Foto Modal */}
      {photoModal && (
        <div className="photo-modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="photo-modal-close" onClick={() => setPhotoModal(null)}>
              <X size={24} />
            </button>
            <img 
              src={`http://localhost:5000/${photoModal.replace(/\\/g, '/')}`} 
              alt="Warenannahme Foto" 
              className="photo-modal-image"
            />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedReceipt && (
        <div className="details-modal" onClick={() => setSelectedReceipt(null)}>
          <div className="details-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="details-header">
              <h3>Warenannahme WA-{selectedReceipt.kWarenannahme}</h3>
              <button 
                className="close-btn"
                onClick={() => setSelectedReceipt(null)}
              >
                ×
              </button>
            </div>
            
            <div className="details-body">
              <div className="details-grid">
                <div className="detail-item">
                  <label>Datum & Zeit:</label>
                  <span>{formatDate(selectedReceipt.dDatum)} um {formatTime(selectedReceipt.tUhrzeit)}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  {getStatusBadge(selectedReceipt.cStatus)}
                </div>
                <div className="detail-item">
                  <label>Transporteur:</label>
                  <span>{selectedReceipt.cTransporteur}</span>
                </div>
                <div className="detail-item">
                  <label>Packstücke:</label>
                  <span>{selectedReceipt.nAnzahlPackstuecke}x {selectedReceipt.cPackstueckArt}</span>
                </div>
                <div className="detail-item">
                  <label>Zustand:</label>
                  <span className={`zustand-text ${selectedReceipt.cZustand === 'In Ordnung' ? 'gut' : 'beschaedigt'}`}>
                    {selectedReceipt.cZustand}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Palettentausch:</label>
                  <span>{selectedReceipt.bPalettentausch ? 'Ja' : 'Nein'}</span>
                </div>
                {selectedReceipt.cJTLLieferantenbestellnummer && (
                  <div className="detail-item">
                    <label>JTL Bestellnummer:</label>
                    <span>{selectedReceipt.cJTLLieferantenbestellnummer}</span>
                  </div>
                )}
                {selectedReceipt.cAnmerkung && (
                  <div className="detail-item full-width">
                    <label>Anmerkung:</label>
                    <span>{selectedReceipt.cAnmerkung}</span>
                  </div>
                )}
                {selectedReceipt.MitarbeiterName && (
                  <div className="detail-item">
                    <label>Erfasst von:</label>
                    <span>{selectedReceipt.MitarbeiterName}</span>
                  </div>
                )}
                {selectedReceipt.cFotoPath && (
                  <div className="detail-item full-width">
                    <label>Foto:</label>
                    <button 
                      className="view-photo-button"
                      onClick={() => {
                        setPhotoModal(selectedReceipt.cFotoPath);
                        setSelectedReceipt(null);
                      }}
                    >
                      <Image size={16} />
                      Foto anzeigen
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerGoodsReceipts;