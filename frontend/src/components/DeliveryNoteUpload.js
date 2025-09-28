import React, { useState, useRef } from 'react';
import './DeliveryNoteUpload.css'; // Unser neues CSS importieren

const DeliveryNoteUpload = ({ warenannahmeId, onUploadSuccess, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [beschreibung, setBeschreibung] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Bitte wählen Sie eine PDF-Datei aus');
      setSelectedFile(null);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Bitte wählen Sie eine PDF-Datei aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      if (beschreibung.trim()) {
        formData.append('beschreibung', beschreibung.trim());
      }

      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/documents/upload/${warenannahmeId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload fehlgeschlagen');
      }

      // Reset form
      setSelectedFile(null);
      setBeschreibung('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Erfolg melden
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
    } catch (err) {
      console.error('Upload-Fehler:', err);
      setError(err.message || 'Fehler beim Hochladen der Datei');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="delivery-upload-overlay">
      <div className="delivery-upload-modal">
        {/* 🎨 SCHÖNER HEADER */}
        <div className="delivery-upload-header">
          <div className="delivery-upload-title">
            <h3>
              📄 Lieferschein hochladen
            </h3>
            <button
              onClick={onClose}
              className="close-btn"
              disabled={uploading}
            >
              ×
            </button>
          </div>
        </div>

        {/* 📋 CONTENT */}
        <div className="delivery-upload-content">
          {/* Drop Zone - MIT NEUEN KLASSEN */}
          <div
            className={`upload-drop-zone ${
              dragActive 
                ? 'drag-active' 
                : selectedFile 
                  ? 'file-selected' 
                  : ''
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="space-y-2" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                <div style={{ 
                  fontWeight: '600', 
                  color: '#059669', 
                  fontSize: '18px',
                  marginBottom: '8px'
                }}>
                  {selectedFile.name}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  marginBottom: '16px'
                }}>
                  {formatFileSize(selectedFile.size)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{
                    fontSize: '14px',
                    color: '#dc2626',
                    background: 'none',
                    border: 'none',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#fef2f2';
                    e.target.style.color = '#b91c1c';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'none';
                    e.target.style.color = '#dc2626';
                  }}
                >
                  🗑️ Datei entfernen
                </button>
              </div>
            ) : (
              <div className="space-y-2" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📎</div>
                <div style={{ 
                  color: '#4b5563', 
                  fontSize: '18px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  PDF-Datei hier ablegen
                </div>
                <div style={{ 
                  color: '#6b7280', 
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  oder hier klicken zum Auswählen
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#9ca3af',
                  background: 'rgba(255, 255, 255, 0.7)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'inline-block'
                }}>
                  📏 Maximale Dateigröße: 20MB
                </div>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {/* 📝 Beschreibung */}
          <div className="description-field">
            <label>
              Beschreibung (optional)
            </label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="z.B. Original-Lieferschein von DHL..."
              maxLength={500}
              style={{ fontFamily: 'inherit' }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#9ca3af', 
              textAlign: 'right',
              marginTop: '4px'
            }}>
              {beschreibung.length}/500 Zeichen
            </div>
          </div>

          {/* ⚠️ Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* 🚀 FOOTER MIT SCHÖNEN BUTTONS */}
        <div className="delivery-upload-footer">
          <button
            onClick={onClose}
            className="cancel-button"
            disabled={uploading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="upload-button"
          >
            {uploading ? (
              <>
                <div className="loading-spinner"></div>
                Uploading...
              </>
            ) : (
              <>
                🚀 Hochladen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryNoteUpload;