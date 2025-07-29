// frontend/src/components/GoodsReceiptForm.js
import React, { useState, useEffect } from 'react';
import { Camera, Save, X, Upload } from 'lucide-react';
import './GoodsReceiptForm.css';
import { goodsReceiptAPI, customersAPI } from '../services/api';
import GoodsReceiptLabel from './GoodsReceiptLabel';

const GoodsReceiptForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    dDatum: new Date().toISOString().split('T')[0], // Heute
    tUhrzeit: new Date().toTimeString().slice(0, 5), // Aktuelle Zeit
    kKunde: '',
    cTransporteur: '',
    cPackstueckArt: 'Karton',
    nAnzahlPackstuecke: 1,
    cZustand: 'In Ordnung',
    bPalettentausch: false,
    cJTLLieferantenbestellnummer: '',
    cAnmerkung: '',
    photo: null
  });
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showLabelAfterSave, setShowLabelAfterSave] = useState(false);
  const [savedReceiptData, setSavedReceiptData] = useState(null);

  useEffect(() => {
    // Echte Fulfillment-Kunden laden
    const loadCustomers = async () => {
      try {
        console.log('👥 Lade Fulfillment-Kunden...');
        const response = await customersAPI.getAll();
        console.log('✅ Kunden geladen:', response.data);
        setCustomers(response.data);
      } catch (error) {
        console.error('❌ Fehler beim Laden der Kunden:', error);
        // Fallback: Mock-Daten bei Fehler
        setCustomers([
          { kKunde: 1, cKundenNr: 'K12345', cFirma: 'Musterfirma GmbH' }
        ]);
      }
    };
    
    loadCustomers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, photo: file }));
      
      // Vorschau erstellen
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }));
    setPhotoPreview(null);
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

      // FormData erstellen für File-Upload
      const submitData = new FormData();
      
      // Alle Felder anhängen
      Object.keys(formData).forEach(key => {
        if (key === 'photo' && formData[key]) {
          submitData.append('photo', formData[key]); // WICHTIG: 'photo' statt 'foto'
        } else if (key === 'bPalettentausch') {
          submitData.append(key, formData[key] ? 'true' : 'false');
        } else if (key !== 'photo') { // photo nicht doppelt anhängen
          submitData.append(key, formData[key] || '');
        }
      });

      const response = await goodsReceiptAPI.create(submitData);
      
      console.log('✅ Warenannahme erstellt:', response.data);
      
      // Erfolg anzeigen
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
        cAnmerkung: '',
        photo: null
      });
      setPhotoPreview(null);
      
      // Dashboard aktualisieren
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
            placeholder="z.B. DHL, UPS, Spedition Müller"
            required
          />
        </div>

        {/* Packstücke */}
        <div className="form-row">
          <div className="form-group">
            <label>Art der Packstücke *</label>
            <select
              name="cPackstueckArt"
              value={formData.cPackstueckArt}
              onChange={handleInputChange}
              required
            >
              <option value="Karton">Karton</option>
              <option value="Einwegpalette">Einwegpalette</option>
              <option value="Europalette">Europalette</option>
              <option value="Container">Container</option>
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

        {/* Zustand und Palettentausch */}
        <div className="form-row">
          <div className="form-group">
            <label>Zustand *</label>
            <select
              name="cZustand"
              value={formData.cZustand}
              onChange={handleInputChange}
              required
            >
              <option value="In Ordnung">In Ordnung</option>
              <option value="Beschädigt">Beschädigt</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="bPalettentausch"
                checked={formData.bPalettentausch}
                onChange={handleInputChange}
              />
              Palettentausch
            </label>
          </div>
        </div>

        {/* JTL Lieferantenbestellnummer */}
        <div className="form-group">
          <label>JTL Lieferantenbestellnummer</label>
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

        {/* Foto-Upload */}
        <div className="form-group">
          <label>Foto (bei Beschädigungen)</label>
          <div className="photo-upload-area">
            {!photoPreview ? (
              <label className="photo-upload-label">
                <Camera size={24} />
                <span>Foto aufnehmen/hochladen</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <div className="photo-preview">
                <img src={photoPreview} alt="Vorschau" />
                <button type="button" onClick={removePhoto} className="remove-photo">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="submit" 
            disabled={loading}
            className="submit-button"
          >
            {loading ? (
              <>⏳ Speichern...</>
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