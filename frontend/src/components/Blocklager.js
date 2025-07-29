// frontend/src/components/Blocklager.js
import React, { useState } from 'react';
import { Search, Save, Package, X, AlertCircle, CheckCircle } from 'lucide-react';
import './Blocklager.css';

const Blocklager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Formular-Felder für die drei Blocklager-Werte
  const [formData, setFormData] = useState({
    anzahlPalette: '',
    anzahlMasterkartons: '',
    anzahlStueckProMasterkarton: ''
  });

  // Artikel suchen
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Bitte Artikelnummer oder Barcode eingeben');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setSearchResult(null);

    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Starte Artikelsuche für:', searchTerm.trim());
      
      const response = await fetch(`http://localhost:5000/api/blocklager/artikel/search?q=${encodeURIComponent(searchTerm.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response Status:', response.status);
      console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response Error Text:', errorText);
        
        if (response.status === 404) {
          throw new Error('Artikel nicht gefunden');
        }
        throw new Error(`Fehler bei der Suche: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('📄 Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ Antwort ist kein JSON:', textResponse);
        throw new Error('Server-Antwort ist kein JSON');
      }

      const data = await response.json();
      console.log('Artikeldaten erhalten:', data);
      
      setSearchResult(data);
      
      // Formular mit vorhandenen Werten befüllen
      setFormData({
        anzahlPalette: data.anzahlArtikelProPalette || '',
        anzahlMasterkartons: data.anzahlMasterkartonsProPalette || '',
        anzahlStueckProMasterkarton: data.anzahlStueckProMasterkarton || ''
      });

    } catch (err) {
      console.error('Suchfehler:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enter-Taste für Suche
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Formular-Eingaben aktualisieren
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Werte speichern
  const handleSave = async () => {
    if (!searchResult) {
      setError('Kein Artikel ausgewählt');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/blocklager/artikel/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artnr: searchResult.cArtNr,
          anzahlPalette: formData.anzahlPalette,
          anzahlMasterkartons: formData.anzahlMasterkartons,
          anzahlStueckProMasterkarton: formData.anzahlStueckProMasterkarton
        })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      const result = await response.json();
      console.log('Speichern erfolgreich:', result);
      
      setSuccess('Blocklager-Daten erfolgreich gespeichert!');
      
      // Nach 3 Sekunden Success-Message ausblenden
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Speicherfehler:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Suche zurücksetzen
  const handleReset = () => {
    setSearchTerm('');
    setSearchResult(null);
    setFormData({
      anzahlPalette: '',
      anzahlMasterkartons: '',
      anzahlStueckProMasterkarton: ''
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="blocklager-container">
      <div className="section-header">
        <h2>
          <Package size={24} />
          Blocklager Verwaltung
        </h2>
        <p>Artikel suchen und Blocklager-Informationen verwalten</p>
      </div>

      {/* Suchbereich */}
      <div className="search-section">
        <div className="search-input-group">
          <div className="search-field">
            <Search size={20} />
            <input
              type="text"
              placeholder="Artikelnummer oder Barcode eingeben..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              disabled={loading}
            />
          </div>
          <button 
            className="search-button"
            onClick={handleSearch}
            disabled={loading || !searchTerm.trim()}
          >
            {loading ? 'Sucht...' : 'Suchen'}
          </button>
          {searchResult && (
            <button 
              className="reset-button"
              onClick={handleReset}
              title="Suche zurücksetzen"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="message error-message">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Artikel-Ergebnis und Formular */}
      {searchResult && (
        <div className="article-section">
          <div className="article-info">
            <h3>Artikel gefunden</h3>
            <div className="article-details">
              <div className="article-field">
                <label>Artikelnummer:</label>
                <span className="article-value">{searchResult.cArtNr}</span>
              </div>
              <div className="article-field">
                <label>Artikelname:</label>
                <span className="article-value">{searchResult.cName}</span>
              </div>
              {searchResult.cBarcode && (
                <div className="article-field">
                  <label>Barcode:</label>
                  <span className="article-value">{searchResult.cBarcode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Blocklager-Felder */}
          <div className="blocklager-form">
            <h3>Blocklager-Informationen</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Anzahl Artikel auf einer Palette</label>
                <input
                  type="number"
                  min="0"
                  placeholder="z.B. 50"
                  value={formData.anzahlPalette}
                  onChange={(e) => handleInputChange('anzahlPalette', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Anzahl Masterkartons auf einer Palette</label>
                <input
                  type="number"
                  min="0"
                  placeholder="z.B. 10"
                  value={formData.anzahlMasterkartons}
                  onChange={(e) => handleInputChange('anzahlMasterkartons', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Stück pro Masterkarton</label>
                <input
                  type="number"
                  min="0"
                  placeholder="z.B. 24"
                  value={formData.anzahlStueckProMasterkarton}
                  onChange={(e) => handleInputChange('anzahlStueckProMasterkarton', e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                className="save-button"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={20} />
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leer-Zustand */}
      {!searchResult && !loading && !error && (
        <div className="empty-state">
          <Package size={48} />
          <h3>Artikel suchen</h3>
          <p>Geben Sie eine Artikelnummer oder einen Barcode ein, um die Blocklager-Informationen zu verwalten.</p>
        </div>
      )}
    </div>
  );
};

export default Blocklager;