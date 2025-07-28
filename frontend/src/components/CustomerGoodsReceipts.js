// frontend/src/components/CustomerGoodsReceipts.js
import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, AlertCircle, Camera, Eye } from 'lucide-react';
import { goodsReceiptAPI } from '../services/api';
import './CustomerGoodsReceipts.css';

const CustomerGoodsReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);

  useEffect(() => {
    loadCustomerReceipts();
  }, []);

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
      <div className={`status-badge ${config.color}`}>
        <Icon size={14} />
        {config.label}
      </div>
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
      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        return timeStr.slice(0, 5); // "HH:MM"
      }
      return timeStr;
    } catch {
      return timeStr;
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
      <div className="receipts-header">
        <h2>Ihre Warenannahmen</h2>
        <p>Hier sehen Sie alle Ihre eingehenden Lieferungen im Überblick</p>
      </div>

      {receipts.length === 0 ? (
        <div className="empty-state">
          <Package size={64} />
          <h3>Keine Warenannahmen vorhanden</h3>
          <p>Es wurden noch keine Lieferungen für Sie erfasst.</p>
        </div>
      ) : (
        <div className="receipts-grid">
          {receipts.map((receipt) => (
            <div key={receipt.kWarenannahme} className="receipt-card">
              <div className="receipt-header">
                <div className="receipt-id">
                  WA-{receipt.kWarenannahme}
                </div>
                {getStatusBadge(receipt.cStatus)}
              </div>

              <div className="receipt-content">
                <div className="receipt-info">
                  <div className="info-row">
                    <span className="label">Datum:</span>
                    <span className="value">{formatDate(receipt.dDatum)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Uhrzeit:</span>
                    <span className="value">{formatTime(receipt.tUhrzeit)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Transporteur:</span>
                    <span className="value">{receipt.cTransporteur}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Packstücke:</span>
                    <span className="value">
                      {receipt.nAnzahlPackstuecke}x {receipt.cPackstueckArt}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">Zustand:</span>
                    <span className="value">{receipt.cZustand}</span>
                  </div>
                  {receipt.cAnmerkung && (
                    <div className="info-row">
                      <span className="label">Anmerkung:</span>
                      <span className="value">{receipt.cAnmerkung}</span>
                    </div>
                  )}
                </div>

                <div className="receipt-actions">
                  {receipt.cFotoPath && (
                    <button 
                      onClick={() => setPhotoModal(receipt.cFotoPath)}
                      className="action-btn photo-btn"
                      title="Foto anzeigen"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedReceipt(receipt)}
                    className="action-btn details-btn"
                    title="Details anzeigen"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Foto Modal */}
      {photoModal && (
        <div className="photo-modal" onClick={() => setPhotoModal(null)}>
          <div className="photo-modal-content">
            <button 
              className="photo-modal-close"
              onClick={() => setPhotoModal(null)}
            >
              ×
            </button>
            <img 
              src={`http://localhost:5000/${photoModal}`} 
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
                  <span>{selectedReceipt.cZustand}</span>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerGoodsReceipts;