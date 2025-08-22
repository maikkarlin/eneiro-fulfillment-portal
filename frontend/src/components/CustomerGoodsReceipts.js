// frontend/src/components/CustomerGoodsReceipts.js - KOMPLETT MIT DOKUMENT-INTEGRATION
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
import DocumentsDisplay from './DocumentsDisplay';

const CustomerGoodsReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [documentCounts, setDocumentCounts] = useState({});
  
  // Such- und Filter-States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [filteredReceipts, setFilteredReceipts] = useState([]);

  useEffect(() => {
    loadCustomerReceipts();
  }, []);

  // Filter-Logik
  useEffect(() => {
    if (!receipts || !Array.isArray(receipts)) {
      console.warn('⚠️ receipts ist kein Array:', receipts);
      setFilteredReceipts([]);
      return;
    }

    let filtered = [...receipts];

    // Suchfilter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        (item.kWarenannahme && item.kWarenannahme.toString().includes(searchTerm)) ||
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

  // NEU: Dokument-Anzahl für alle Warenannahmen laden
  useEffect(() => {
    if (Array.isArray(receipts) && receipts.length > 0) {
      receipts.forEach(receipt => {
        loadDocumentCount(receipt.kWarenannahme);
      });
    }
  }, [receipts]);

  // NEU: Funktion zum Laden der Dokument-Anzahl
  const loadDocumentCount = async (warenannahmeId) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/documents/warenannahme/${warenannahmeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const documents = await response.json();
        setDocumentCounts(prev => ({
          ...prev,
          [warenannahmeId]: documents.length
        }));
      }
    } catch (err) {
      // Stillschweigend ignorieren - Dokumente sind optional
      console.log('Dokumente für Warenannahme', warenannahmeId, 'konnten nicht geladen werden');
    }
  };

  const loadCustomerReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('📦 Lade Kunden-Warenannahmen...');
      const response = await goodsReceiptAPI.getCustomerReceipts();
      
      console.log('✅ API Response:', response.data);
      
      // Sichere Datenextraktion
      const data = response.data?.data || response.data || [];
      
      console.log('✅ Extrahierte Receipts:', data.length, 'Einträge');
      
      // Sicherheitsprüfung
      setReceipts(Array.isArray(data) ? data : []);
      
    } catch (err) {
      console.error('❌ Fehler beim Laden der Warenannahmen:', err);
      setError('Fehler beim Laden Ihrer Warenannahmen: ' + (err.response?.data?.error || err.message));
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    return (
      <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>
        {status}
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
      
      if (typeof timeStr === 'string') {
        if (timeStr.includes(':')) {
          return timeStr.substring(0, 5);
        }
      }
      
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

  if (!Array.isArray(receipts)) {
    return (
      <div className="customer-receipts-container">
        <div className="error-card">
          <AlertCircle size={48} />
          <h3>Datenformat-Fehler</h3>
          <p>Die Warenannahmen konnten nicht geladen werden.</p>
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

      {/* Such- und Filterbereich */}
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
                <th>Dokumente</th>
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
                        onClick={() => {
                          console.log('🖱️ Foto-Button (Customer) geklickt, Pfad:', receipt.cFotoPath);
                          setPhotoModal(receipt.cFotoPath);
                        }}
                        className="photo-button"
                        title="Foto anzeigen"
                      >
                        <Camera size={16} />
                      </button>
                    ) : (
                      <span className="no-photo">Kein Foto</span>
                    )}
                  </td>
                  <td>
                    {documentCounts[receipt.kWarenannahme] > 0 ? (
                      <span className="documents-count-badge">
                        📄 {documentCounts[receipt.kWarenannahme]}
                      </span>
                    ) : (
                      <span className="no-documents">Keine</span>
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => setSelectedReceipt(receipt)}
                      className="action-button"
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

      {/* Foto-Modal */}
      {photoModal && (
        <PhotoModal 
          photoPath={photoModal} 
          onClose={() => setPhotoModal(null)} 
        />
      )}

      {/* Details-Modal */}
      {selectedReceipt && (
        <ReceiptDetailsModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
    </div>
  );
};

// ===== REPARIERTE FOTO-MODAL KOMPONENTE =====
const PhotoModal = ({ photoPath, onClose }) => {
  console.log('🖼️ PhotoModal (Customer) - Foto-Pfad:', photoPath);
  
  // Korrekte URL konstruieren
  const getPhotoUrl = (path) => {
    if (!path) return null;
    
    // Backslashes durch Slashes ersetzen
    const cleanPath = path.replace(/\\/g, '/');
    
    // Wenn bereits mit "uploads/" beginnt, direkt verwenden
    if (cleanPath.startsWith('uploads/')) {
      return `http://localhost:5000/${cleanPath}`;
    }
    
    // Ansonsten "uploads/warenannahme/" voranstellen
    return `http://localhost:5000/uploads/warenannahme/${cleanPath}`;
  };
  
  const photoUrl = getPhotoUrl(photoPath);
  console.log('🔗 Generierte Foto-URL:', photoUrl);
  
  if (!photoUrl) {
    return (
      <div className="photo-modal-overlay" onClick={onClose}>
        <div className="photo-modal-content">
          <button className="photo-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>❌ Foto nicht verfügbar</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        <img 
          src={photoUrl}
          alt="Warenannahme Foto" 
          className="photo-modal-image"
          onLoad={() => console.log('✅ Foto geladen:', photoUrl)}
          onError={(e) => {
            console.error('❌ Foto-Fehler:', photoUrl);
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML += `
              <div style="padding: 20px; text-align: center;">
                <p>❌ Foto konnte nicht geladen werden</p>
                <p>URL: ${photoUrl}</p>
              </div>
            `;
          }}
        />
      </div>
    </div>
  );
};

// NEU: ERWEITERTE DETAILS-MODAL KOMPONENTE MIT DOKUMENTEN
const ReceiptDetailsModal = ({ receipt, onClose }) => {
  const [documentCount, setDocumentCount] = useState(0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h3>Warenannahme WA-{receipt.kWarenannahme}</h3>
            {documentCount > 0 && (
              <span className="document-counter-badge">
                📄 {documentCount} Dokument{documentCount !== 1 ? 'e' : ''}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body">
          {/* Bestehende Detail-Grid */}
          <div className="detail-grid">
            <div className="detail-item">
              <label>Datum & Zeit:</label>
              <span>{new Date(receipt.dDatum).toLocaleDateString('de-DE')} um {receipt.tUhrzeit || 'N/A'}</span>
            </div>
            
            <div className="detail-item">
              <label>Transporteur:</label>
              <span>{receipt.cTransporteur || 'Nicht angegeben'}</span>
            </div>
            
            <div className="detail-item">
              <label>Packstücke:</label>
              <span>{receipt.nAnzahlPackstuecke}x {receipt.cPackstueckArt}</span>
            </div>
            
            <div className="detail-item">
              <label>Zustand:</label>
              <span className={`zustand-badge ${receipt.cZustand === 'In Ordnung' ? 'gut' : 'beschaedigt'}`}>
                {receipt.cZustand}
              </span>
            </div>
            
            <div className="detail-item">
              <label>Status:</label>
              <span className={`status-badge ${receipt.cStatus.toLowerCase().replace(' ', '-')}`}>
                {receipt.cStatus}
              </span>
            </div>
            
            <div className="detail-item">
              <label>JTL-Bestellnummer:</label>
              <span>{receipt.cJTLLieferantenbestellnummer || 'Nicht angegeben'}</span>
            </div>
            
            <div className="detail-item">
              <label>Palettentausch:</label>
              <span>{receipt.bPalettentausch ? 'Ja' : 'Nein'}</span>
            </div>
            
            {receipt.cAnmerkung && (
              <div className="detail-item full-width">
                <label>Anmerkung:</label>
                <span>{receipt.cAnmerkung}</span>
              </div>
            )}
            
            {receipt.MitarbeiterName && (
              <div className="detail-item">
                <label>Erfasst von:</label>
                <span>{receipt.MitarbeiterName}</span>
              </div>
            )}
            
            <div className="detail-item">
              <label>Erstellt:</label>
              <span>{new Date(receipt.dErstellt).toLocaleString('de-DE')}</span>
            </div>
          </div>
          
          {/* NEU: Dokumente-Sektion */}
          <div className="documents-section">
            <h4>📄 Lieferscheine & Dokumente</h4>
            <DocumentsDisplay
              warenannahmeId={receipt.kWarenannahme}
              userRole="customer"
              onDocumentCountChange={setDocumentCount}
              onUploadClick={null} // Kunden können nicht uploaden
            />
          </div>
          
          {/* Bestehende Foto-Sektion */}
          {receipt.cFotoPath && (
            <div className="photo-section">
              <h4>Foto der Lieferung</h4>
              <img 
                src={(() => {
                  const cleanPath = receipt.cFotoPath.replace(/\\/g, '/');
                  const finalUrl = cleanPath.startsWith('uploads/') 
                    ? `http://localhost:5000/${cleanPath}`
                    : `http://localhost:5000/uploads/warenannahme/${cleanPath}`;
                  console.log('🖼️ Details Modal Foto-URL:', finalUrl);
                  return finalUrl;
                })()}
                alt="Warenannahme Foto" 
                className="receipt-photo"
                onError={(e) => {
                  console.error('❌ Details Modal Foto-Fehler');
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerGoodsReceipts;