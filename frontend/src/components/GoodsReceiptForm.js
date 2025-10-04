// frontend/src/components/GoodsReceiptForm.js - MIT MULTI-PHOTO UPLOAD
import React, { useState, useEffect } from 'react';
import { Camera, Save, X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import './GoodsReceiptForm.css';
import { goodsReceiptAPI, customersAPI } from '../services/api';
import GoodsReceiptLabel from './GoodsReceiptLabel';

const GoodsReceiptForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    dDatum: new Date().toISOString().split('T')[0],
    tUhrzeit: new Date().toTimeString().slice(0, 5),
    kKunde: '',
    cTransporteur: '',
    cPackstueckArt: 'Karton',
    nAnzahlPackstuecke: 1,
    cZustand: 'In Ordnung',
    bPalettentausch: false,
    cJTLLieferantenbestellnummer: '',
    cAnmerkung: ''
  });
  
  // ✅ NEU: Mehrere Fotos verwalten
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [compressing, setCompressing] = useState(false);
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLabelAfterSave, setShowLabelAfterSave] = useState(false);
  const [savedReceiptData, setSavedReceiptData] = useState(null);

  const MAX_PHOTOS = 10;

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      console.log('👥 Lade Fulfillment-Kunden...');
      const response = await customersAPI.getAll();
      console.log('✅ Kunden geladen:', response.data);
      setCustomers(response.data);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kunden:', error);
      setCustomers([
        { kKunde: 1, cKundenNr: 'K12345', cFirma: 'Musterfirma GmbH' }
      ]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ✅ NEU: Bild-Komprimierung
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new window.Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1920;
          
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File(
                  [blob], 
                  file.name.replace(/\.(jpg|jpeg|png|heic|heif)$/i, '.jpg'),
                  { type: 'image/jpeg' }
                );
                
                const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                console.log(`✅ Komprimiert: ${file.name} → ${sizeMB}MB`);
                
                resolve(compressedFile);
              } else {
                reject(new Error('Komprimierung fehlgeschlagen'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      reader.readAsDataURL(file);
    });
  };

  // ✅ NEU: Multiple Fotos hinzufügen
  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // Prüfen ob Limit überschritten wird
    if (photos.length + files.length > MAX_PHOTOS) {
      alert(`Maximal ${MAX_PHOTOS} Fotos erlaubt`);
      return;
    }
    
    setCompressing(true);
    setError('');
    
    try {
      const compressedFiles = [];
      const newPreviews = [];
      
      for (const file of files) {
        console.log(`📸 Komprimiere: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
        
        const compressedFile = await compressImage(file);
        compressedFiles.push(compressedFile);
        
        // Vorschau erstellen
        const reader = new FileReader();
        const preview = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(compressedFile);
        });
        newPreviews.push(preview);
      }
      
      setPhotos(prev => [...prev, ...compressedFiles]);
      setPhotoPreviews(prev => [...prev, ...newPreviews]);
      
      console.log(`✅ ${files.length} Foto(s) hinzugefügt`);
      
    } catch (err) {
      console.error('❌ Fehler beim Komprimieren:', err);
      setError('Fehler beim Verarbeiten der Fotos: ' + err.message);
    } finally {
      setCompressing(false);
      e.target.value = ''; // Input zurücksetzen
    }
  };

  // ✅ NEU: Foto entfernen
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('📦 Sende Warenannahme-Daten:', formData);
      
      // Validierung
      if (!formData.kKunde) {
        throw new Error('Bitte wählen Sie einen Kunden aus');
      }
      
      if (!formData.cTransporteur.trim()) {
        throw new Error('Bitte geben Sie den Transporteur an');
      }
      
      if (formData.nAnzahlPackstuecke < 1) {
        throw new Error('Anzahl Packstücke muss mindestens 1 sein');
      }

      // FormData erstellen
      const submitData = new FormData();
      
      // Basis-Felder
      Object.keys(formData).forEach(key => {
        if (key === 'bPalettentausch') {
          submitData.append(key, formData[key] ? 'true' : 'false');
        } else {
          submitData.append(key, formData[key] || '');
        }
      });

      // ✅ NEU: Alle Fotos anhängen
      // Erstes Foto als "photo" (für Abwärtskompatibilität)
      if (photos.length > 0) {
        submitData.append('photo', photos[0]);
        
        // Weitere Fotos als "additionalPhotos"
        for (let i = 1; i < photos.length; i++) {
          submitData.append('additionalPhotos', photos[i]);
        }
      }

      console.log(`📤 Sende ${photos.length} Foto(s)`);

      const response = await goodsReceiptAPI.create(submitData);
      
      console.log('✅ Warenannahme erstellt:', response.data);
      
      alert('Warenannahme erfolgreich erfasst!');
      
      // Daten für Etikettendruck speichern
      setSavedReceiptData(response.data);
      setShowLabelAfterSave(true);
      
      // Formular zurücksetzen
      setFormData({
        dDatum: new Date().toISOString().split('T')[0],
        tUhrzeit: new Date().toTimeString().slice(0, 5),
        kKunde: '',
        cTransporteur: '',
        cPackstueckArt: 'Karton',
        nAnzahlPackstuecke: 1,
        cZustand: 'In Ordnung',
        bPalettentausch: false,
        cJTLLieferantenbestellnummer: '',
        cAnmerkung: ''
      });
      setPhotos([]);
      setPhotoPreviews([]);
      
      if (onSuccess) onSuccess();
      
    } catch (err) {
      console.error('❌ Fehler beim Erstellen der Warenannahme:', err);
      setError(err.response?.data?.error || err.message || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="goods-receipt-form-container">
      <div className="form-header">
        <h2>Neue Warenannahme erfassen</h2>
        <p>Erfassen Sie hier alle wichtigen Informationen zur eingehenden Lieferung</p>
      </div>

      {error && (
        <div className="error-message">
          <X size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="goods-receipt-form">
        {/* Datum und Zeit */}
        <div className="form-row">
          <div className="form-group">
            <label>Datum *</label>
            <input
              type="date"
              name="dDatum"
              value={formData.dDatum}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Uhrzeit *</label>
            <input
              type="time"
              name="tUhrzeit"
              value={formData.tUhrzeit}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {/* Kunde */}
        <div className="form-group">
          <label>Fulfillment Kunde *</label>
          <select
            name="kKunde"
            value={formData.kKunde}
            onChange={handleInputChange}
            required
          >
            <option value="">Kunde auswählen...</option>
            {customers.map(customer => (
              <option key={customer.kKunde} value={customer.kKunde}>
                {customer.cKundenNr} - {customer.cFirma}
              </option>
            ))}
          </select>
        </div>

        {/* Transporteur */}
        <div className="form-group">
          <label>Transporteur (Spedition, Paketdienstleister) *</label>
          <input
            type="text"
            name="cTransporteur"
            value={formData.cTransporteur}
            onChange={handleInputChange}
            placeholder="z.B. DHL, DPD, GLS, Spedition Müller"
            required
          />
        </div>

        {/* Packstücke */}
        <div className="form-row">
          <div className="form-group">
            <label>Packstück-Art *</label>
            <select
              name="cPackstueckArt"
              value={formData.cPackstueckArt}
              onChange={handleInputChange}
              required
            >
              <option value="Karton">Karton</option>
              <option value="Palette">Palette</option>
              <option value="Paket">Paket</option>
              <option value="Sack">Sack</option>
              <option value="Kiste">Kiste</option>
              <option value="Rolle">Rolle</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Anzahl Packstücke *</label>
            <input
              type="number"
              name="nAnzahlPackstuecke"
              value={formData.nAnzahlPackstuecke}
              onChange={handleInputChange}
              min="1"
              required
            />
          </div>
        </div>

        {/* Zustand */}
        <div className="form-group">
          <label>Zustand der Ware *</label>
          <select
            name="cZustand"
            value={formData.cZustand}
            onChange={handleInputChange}
            required
          >
            <option value="In Ordnung">In Ordnung</option>
            <option value="Beschädigt">Beschädigt</option>
            <option value="Teilweise beschädigt">Teilweise beschädigt</option>
          </select>
        </div>

        {/* Palettentausch */}
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="bPalettentausch"
              checked={formData.bPalettentausch}
              onChange={handleInputChange}
            />
            Palettentausch erfolgt
          </label>
        </div>

        {/* JTL Lieferantenbestellnummer */}
        <div className="form-group">
          <label>JTL Lieferantenbestellnummer (optional)</label>
          <input
            type="text"
            name="cJTLLieferantenbestellnummer"
            value={formData.cJTLLieferantenbestellnummer}
            onChange={handleInputChange}
            placeholder="z.B. LB-2024-001 (optional)"
          />
        </div>

        {/* Anmerkung */}
        <div className="form-group">
          <label>Anmerkungen</label>
          <textarea
            name="cAnmerkung"
            value={formData.cAnmerkung}
            onChange={handleInputChange}
            rows="3"
            placeholder="Zusätzliche Bemerkungen zur Anlieferung..."
          />
        </div>

        {/* ✅ NEU: Multi-Foto Upload */}
        <div className="form-group">
          <label>
            Fotos ({photos.length}/{MAX_PHOTOS})
            {compressing && <span style={{ color: '#2a5298', marginLeft: '10px' }}>⏳ Komprimiere...</span>}
          </label>
          
          <div className="multi-photo-upload-area">
            {/* Upload Button */}
            {photos.length < MAX_PHOTOS && (
              <label className="photo-upload-label">
                <div className="upload-icon-wrapper">
                  <Camera size={32} />
                </div>
                <span className="upload-text">
                  Fotos hinzufügen
                </span>
                <span className="upload-hint">
                  Bis zu {MAX_PHOTOS} Fotos, Kamera oder Galerie
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoChange}
                  disabled={compressing || photos.length >= MAX_PHOTOS}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            
            {/* Foto-Galerie */}
            {photoPreviews.length > 0 && (
              <div className="photo-grid">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="photo-preview-item">
                    <img src={preview} alt={`Foto ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="remove-photo-btn"
                      title="Foto entfernen"
                    >
                      <Trash2 size={16} />
                    </button>
                    {index === 0 && (
                      <div className="main-photo-badge">Hauptfoto</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading || compressing}
            className="submit-button"
          >
            {loading ? (
              <>⏳ Speichern...</>
            ) : compressing ? (
              <>⏳ Verarbeite Fotos...</>
            ) : (
              <>
                <Save size={20} />
                Warenannahme erfassen
              </>
            )}
          </button>
        </div>
      </form>

      {/* Etiketten-Modal */}
      {showLabelAfterSave && savedReceiptData && (
        <GoodsReceiptLabel
          goodsReceipt={savedReceiptData}
          onPrint={() => {
            alert('Etikett wurde zum Drucker gesendet!');
            setShowLabelAfterSave(false);
            setSavedReceiptData(null);
          }}
          onClose={() => {
            setShowLabelAfterSave(false);
            setSavedReceiptData(null);
          }}
        />
      )}
    </div>
  );
};

export default GoodsReceiptForm;