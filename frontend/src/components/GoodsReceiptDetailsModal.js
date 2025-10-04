// frontend/src/components/GoodsReceiptDetailsModal.js - KORRIGIERT
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Truck, 
  Package, 
  FileText, 
  Camera,
  Edit3,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { goodsReceiptAPI } from '../services/api';
import './GoodsReceiptDetailsModal.css';
import DocumentsDisplay from './DocumentsDisplay';
import DeliveryNoteUpload from './DeliveryNoteUpload';
import PhotoGallery from './PhotoGallery';

const GoodsReceiptDetailsModal = ({ 
  goodsReceiptId, 
  onClose, 
  onUpdate, 
  onPhotoClick 
}) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [reloadDocuments, setReloadDocuments] = useState(null);

  useEffect(() => {
    loadDetails();
  }, [goodsReceiptId]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await goodsReceiptAPI.getById(goodsReceiptId);
      setDetails(response.data);
      setEditData(response.data);
      
    } catch (err) {
      console.error('Fehler beim Laden der Details:', err);
      setError('Fehler beim Laden der Details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      await goodsReceiptAPI.update(goodsReceiptId, editData);
      
      setDetails(editData);
      setEditMode(false);
      
      if (onUpdate) onUpdate();
      
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Fehler beim Speichern der Änderungen');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await goodsReceiptAPI.updateStatus(goodsReceiptId, newStatus);
      
      setDetails(prev => ({ ...prev, cStatus: newStatus }));
      setEditData(prev => ({ ...prev, cStatus: newStatus }));
      
      if (onUpdate) onUpdate();
      
    } catch (err) {
      console.error('Fehler beim Status-Update:', err);
      setError('Fehler beim Ändern des Status');
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading-container">
            <div className="loading-spinner">⏳</div>
            <p>Lade Details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="error-container">
            <p className="error-message">{error || 'Details nicht gefunden'}</p>
            <button onClick={onClose} className="close-button">Schließen</button>
          </div>
        </div>
      </div>
    );
  }

  const handleUploadClick = (reloadFn) => {
    setReloadDocuments(() => reloadFn);
    setShowUploadModal(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    if (reloadDocuments) reloadDocuments();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Eingegangen': return '#1976d2';
      case 'In Einlagerung': return '#f57c00';
      case 'Eingelagert': return '#388e3c';
      default: return '#666';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const timeMatch = timeString.match(/(\d{2}):(\d{2})/);
    return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : timeString;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <h2>Warenannahme #{details.kWarenannahme}</h2>
            <div 
              className="status-badge-large"
              style={{ backgroundColor: getStatusColor(details.cStatus) }}
            >
              {details.cStatus}
            </div>
          </div>
          <div className="modal-actions">
            {!editMode ? (
              <button 
                className="edit-button"
                onClick={() => setEditMode(true)}
              >
                <Edit3 size={16} />
                Bearbeiten
              </button>
            ) : (
              <div className="edit-actions">
                <button 
                  className="save-button"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save size={16} />
                  Speichern
                </button>
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setEditMode(false);
                    setEditData(details);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            )}
            <button className="close-button" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body">
          {/* Basis-Informationen */}
          <div className="details-section">
            <h3>📋 Basis-Informationen</h3>
            <div className="details-grid">
              <div className="detail-item">
                <Calendar size={16} />
                <span className="label">Datum:</span>
                <span className="value">{formatDate(details.dDatum)}</span>
              </div>
              
              <div className="detail-item">
                <Clock size={16} />
                <span className="label">Uhrzeit:</span>
                <span className="value">{formatTime(details.tUhrzeit)}</span>
              </div>
              
              <div className="detail-item">
                <User size={16} />
                <span className="label">Mitarbeiter:</span>
                <span className="value">{details.MitarbeiterName || 'Unbekannt'}</span>
              </div>
            </div>
          </div>

          {/* Kunde & Transporteur */}
          <div className="details-section">
            <h3>🏢 Kunde & Transport</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="label">Kunde:</span>
                <span className="value">{details.KundenFirma}</span>
              </div>
              
              <div className="detail-item">
                <Truck size={16} />
                <span className="label">Transporteur:</span>
                {editMode ? (
                  <input
                    type="text"
                    value={editData.cTransporteur || ''}
                    onChange={(e) => setEditData({...editData, cTransporteur: e.target.value})}
                    className="edit-input"
                  />
                ) : (
                  <span className="value">{details.cTransporteur}</span>
                )}
              </div>
            </div>
          </div>

          {/* Packstücke */}
          <div className="details-section">
            <h3>📦 Packstücke</h3>
            <div className="details-grid">
              <div className="detail-item">
                <Package size={16} />
                <span className="label">Art:</span>
                {editMode ? (
                  <select
                    value={editData.cPackstueckArt || ''}
                    onChange={(e) => setEditData({...editData, cPackstueckArt: e.target.value})}
                    className="edit-select"
                  >
                    <option value="Karton">Karton</option>
                    <option value="Einwegpalette">Einwegpalette</option>
                    <option value="Europalette">Europalette</option>
                    <option value="Container">Container</option>
                  </select>
                ) : (
                  <span className="value">{details.cPackstueckArt}</span>
                )}
              </div>
              
              <div className="detail-item">
                <span className="label">Anzahl:</span>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.nAnzahlPackstuecke || ''}
                    onChange={(e) => setEditData({...editData, nAnzahlPackstuecke: parseInt(e.target.value)})}
                    className="edit-input"
                    min="1"
                  />
                ) : (
                  <span className="value">{details.nAnzahlPackstuecke}</span>
                )}
              </div>
              
              <div className="detail-item">
                <span className="label">Zustand:</span>
                {editMode ? (
                  <select
                    value={editData.cZustand || ''}
                    onChange={(e) => setEditData({...editData, cZustand: e.target.value})}
                    className="edit-select"
                  >
                    <option value="In Ordnung">In Ordnung</option>
                    <option value="Beschädigt">Beschädigt</option>
                  </select>
                ) : (
                  <span className="value">
                    {details.cZustand === 'In Ordnung' ? '✅ In Ordnung' : '⚠️ Beschädigt'}
                  </span>
                )}
              </div>
              
              <div className="detail-item">
                <span className="label">Palettentausch:</span>
                {editMode ? (
                  <input
                    type="checkbox"
                    checked={editData.bPalettentausch || false}
                    onChange={(e) => setEditData({...editData, bPalettentausch: e.target.checked})}
                    className="edit-checkbox"
                  />
                ) : (
                  <span className="value">
                    {details.bPalettentausch ? '✅ Ja' : '❌ Nein'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* JTL & Anmerkungen */}
          <div className="details-section">
            <h3>📄 Zusätzliche Informationen</h3>
            <div className="details-grid">
              <div className="detail-item">
                <FileText size={16} />
                <span className="label">JTL Lieferantenbestellnummer:</span>
                {editMode ? (
                  <input
                    type="text"
                    value={editData.cJTLLieferantenbestellnummer || ''}
                    onChange={(e) => setEditData({...editData, cJTLLieferantenbestellnummer: e.target.value})}
                    className="edit-input"
                    placeholder="z.B. LB-2024-001"
                  />
                ) : (
                  <span className="value">{details.cJTLLieferantenbestellnummer || 'Nicht angegeben'}</span>
                )}
              </div>
            </div>
            
            {(details.cAnmerkung || editMode) && (
              <div className="detail-item full-width">
                <span className="label">Anmerkungen:</span>
                {editMode ? (
                  <textarea
                    value={editData.cAnmerkung || ''}
                    onChange={(e) => setEditData({...editData, cAnmerkung: e.target.value})}
                    className="edit-textarea"
                    rows="3"
                    placeholder="Zusätzliche Bemerkungen..."
                  />
                ) : (
                  <div className="value anmerkung-text">{details.cAnmerkung}</div>
                )}
              </div>
            )}
          </div>

          {/* Dokumente */}
          <div className="details-section">
            <h3>📄 Dokumente</h3>
            <DocumentsDisplay
              warenannahmeId={details.kWarenannahme}
              userRole="employee"
              onDocumentCountChange={setDocumentCount}
              onUploadClick={handleUploadClick}
              hideTitle={true}
            />
          </div>

          {/* Foto-Galerie - zeigt ALLE Fotos */}
          {details.cFotoPath && (
            <div className="details-section">
              <h3>📷 Fotos der Lieferung</h3>
              <PhotoGallery 
                warenannahmeId={details.kWarenannahme}
                mainPhoto={details.cFotoPath}
              />
            </div>
          )}

          {/* Status-Änderung */}
          {!editMode && (
            <div className="details-section">
              <h3>🔄 Status ändern</h3>
              <div className="status-buttons">
                {['Eingegangen', 'In Einlagerung', 'Eingelagert'].map(status => (
                  <button
                    key={status}
                    className={`status-button ${details.cStatus === status ? 'active' : ''}`}
                    onClick={() => handleStatusChange(status)}
                    disabled={details.cStatus === status}
                    style={{
                      backgroundColor: details.cStatus === status ? getStatusColor(status) : 'transparent',
                      borderColor: getStatusColor(status),
                      color: details.cStatus === status ? 'white' : getStatusColor(status)
                    }}
                  >
                    {status === 'Eingegangen' && <AlertCircle size={16} />}
                    {status === 'In Einlagerung' && <Package size={16} />}
                    {status === 'Eingelagert' && <CheckCircle size={16} />}
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <DeliveryNoteUpload
          warenannahmeId={details.kWarenannahme}
          onUploadSuccess={handleUploadSuccess}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
};

export default GoodsReceiptDetailsModal;