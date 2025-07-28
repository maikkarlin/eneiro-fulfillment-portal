// frontend/src/components/CustomerGoodsReceipts.js
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Calendar, 
  Truck, 
  Camera,
  Eye,
  Search,
  Filter,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Image,
  FileText
} from 'lucide-react';
import { goodsReceiptAPI } from '../services/api';
import './CustomerGoodsReceipts.css';

const CustomerGoodsReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');

  useEffect(() => {
    loadCustomerReceipts();
  }, []);

  useEffect(() => {
    filterReceipts();
  }, [receipts, searchTerm, statusFilter]);

  const loadCustomerReceipts = async () => {
    try {
      setLoading(true);
      const response = await goodsReceiptAPI.getCustomerReceipts();
      setReceipts(response.data);
      setError('');
    } catch (err) {
      console.error('Fehler beim Laden der Warenannahmen:', err);
      setError('Fehler beim Laden Ihrer Warenannahmen');
    } finally {
      setLoading(false);
    }
  };

  const filterReceipts = () => {
    let filtered = [...receipts];

    // Suchfilter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.kWarenannahme.toString().includes(searchTerm) ||
        (item.cTransporteur && item.cTransporteur.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.cPackstueckArt && item.cPackstueckArt.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status-Filter
    if (statusFilter !== 'alle') {
      filtered = filtered.filter(item => item.cStatus === statusFilter);
    }

    setFilteredReceipts(filtered);
  };

  const loadReceiptDetails = async (id) => {
    try {
      const response = await goodsReceiptAPI.getCustomerReceiptById(id);
      setSelectedReceipt(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Details:', err);
      alert('Fehler beim Laden der Details');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Eingegangen':
        return <AlertCircle size={16} />;
      case 'In Einlagerung':
        return <Clock size={16} />;
      case 'Eingelagert':
        return <CheckCircle size={16} />;
      default:
        return <Package size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Eingegangen':
        return '#1976d2';
      case 'In Einlagerung':
        return '#f57c00';
      case 'Eingelagert':
        return '#388e3c';
      default:
        return '#666';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⏳</div>
        <p>Lade Ihre Warenannahmen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={loadCustomerReceipts} className="retry-button">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="customer-goods-receipts">
      <div className="section-header">
        <h2>Meine Warenannahmen</h2>
        <button onClick={loadCustomerReceipts} className="refresh-button">
          🔄 Aktualisieren
        </button>
      </div>

      {/* Such- und Filterbereich */}
      <div className="search-filter-container">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Suche nach ID, Transporteur oder Packstückart..."
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
        <div className="results-info">
          {filteredReceipts.length} von {receipts.length} Warenannahmen gefunden
        </div>
      )}

      {/* Karten-Ansicht für bessere Übersicht */}
      {filteredReceipts.length > 0 ? (
        <div className="receipts-grid">
          {filteredReceipts.map((receipt) => (
            <div key={receipt.kWarenannahme} className="receipt-card">
              <div className="receipt-header">
                <div className="receipt-id">
                  <Package size={20} />
                  <span>WA-{receipt.kWarenannahme}</span>
                </div>
                <div 
                  className="receipt-status"
                  style={{ color: getStatusColor(receipt.cStatus) }}
                >
                  {getStatusIcon(receipt.cStatus)}
                  <span>{receipt.cStatus}</span>
                </div>
              </div>

              <div className="receipt-body">
                <div className="receipt-info">
                  <div className="info-row">
                    <Calendar size={16} />
                    <span>{new Date(receipt.dDatum).toLocaleDateString('de-DE')}</span>
                    <span className="time">{receipt.tUhrzeit}</span>
                  </div>
                  
                  <div className="info-row">
                    <Truck size={16} />
                    <span>{receipt.cTransporteur}</span>
                  </div>

                  <div className="info-row highlight">
                    <Package size={16} />
                    <span>{receipt.nAnzahlPackstuecke}x {receipt.cPackstueckArt}</span>
                  </div>

                  {receipt.cJTLLieferantenbestellnummer && (
                    <div className="info-row">
                      <FileText size={16} />
                      <span className="jtl-number">{receipt.cJTLLieferantenbestellnummer}</span>
                    </div>
                  )}
                </div>

                <div className="receipt-actions">
                  <button
                    className="action-btn details"
                    onClick={() => loadReceiptDetails(receipt.kWarenannahme)}
                    title="Details anzeigen"
                  >
                    <Eye size={18} />
                    Details
                  </button>
                  
                  {receipt.cFotoPath && (
                    <button
                      className="action-btn photo"
                      onClick={() => setPhotoModal(receipt.cFotoPath)}
                      title="Foto anzeigen"
                    >
                      <Camera size={18} />
                      Foto
                    </button>
                  )}
                </div>
              </div>

              {receipt.cZustand === 'Beschädigt' && (
                <div className="damage-indicator">
                  ⚠️ Ware beschädigt
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="no-results">
          {searchTerm || statusFilter !== 'alle' ? (
            <>
              <p>Keine Warenannahmen gefunden</p>
              <p className="no-results-hint">
                Versuchen Sie es mit anderen Suchbegriffen oder Filtern
              </p>
            </>
          ) : (
            <>
              <Package size={48} style={{ opacity: 0.3 }} />
              <p>Noch keine Warenannahmen vorhanden</p>
            </>
          )}
        </div>
      )}

      {/* Details-Modal */}
      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onPhotoClick={setPhotoModal}
        />
      )}

      {/* Foto-Modal */}
      {photoModal && (
        <PhotoModal
          photoPath={photoModal}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  );
};

// Details-Modal Komponente
const ReceiptDetailsModal = ({ receipt, onClose, onPhotoClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Eingegangen': return '#1976d2';
      case 'In Einlagerung': return '#f57c00';
      case 'Eingelagert': return '#388e3c';
      default: return '#666';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content receipt-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Warenannahme Details</h3>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h4>📦 Warenannahme #{receipt.kWarenannahme}</h4>
            <div 
              className="status-badge-large"
              style={{ backgroundColor: getStatusColor(receipt.cStatus) }}
            >
              {receipt.cStatus}
            </div>
          </div>

          <div className="detail-section">
            <h4>📅 Zeitpunkt</h4>
            <p>
              {new Date(receipt.dDatum).toLocaleDateString('de-DE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} um {receipt.tUhrzeit} Uhr
            </p>
          </div>

          <div className="detail-section">
            <h4>🚚 Transport</h4>
            <p>Transporteur: <strong>{receipt.cTransporteur}</strong></p>
            <p>Packstücke: <strong>{receipt.nAnzahlPackstuecke}x {receipt.cPackstueckArt}</strong></p>
            <p>Zustand: <strong>{receipt.cZustand}</strong></p>
            {receipt.bPalettentausch && <p>✅ Palettentausch erfolgt</p>}
          </div>

          {receipt.cJTLLieferantenbestellnummer && (
            <div className="detail-section">
              <h4>📋 Referenzen</h4>
              <p>JTL-Nummer: <strong>{receipt.cJTLLieferantenbestellnummer}</strong></p>
            </div>
          )}

          {receipt.cAnmerkung && (
            <div className="detail-section">
              <h4>💬 Anmerkungen</h4>
              <p className="remarks">{receipt.cAnmerkung}</p>
            </div>
          )}

          {receipt.cFotoPath && (
            <div className="detail-section">
              <h4>📷 Foto</h4>
              <button 
                className="photo-button"
                onClick={() => onPhotoClick(receipt.cFotoPath)}
              >
                <Camera size={20} />
                Foto anzeigen
              </button>
            </div>
          )}

          <div className="detail-section">
            <h4>👤 Erfasst von</h4>
            <p>{receipt.MitarbeiterName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Foto-Modal Komponente
const PhotoModal = ({ photoPath, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
      <button className="photo-close-button" onClick={onClose}>
        <X size={24} />
      </button>
      <img 
        src={`http://localhost:5000/${photoPath.replace(/\\/g, '/')}`} 
        alt="Warenannahme Foto" 
        className="modal-photo"
      />
    </div>
  </div>
);

export default CustomerGoodsReceipts;