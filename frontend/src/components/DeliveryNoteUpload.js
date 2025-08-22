import React, { useState, useRef } from 'react';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            📄 Lieferschein hochladen
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : selectedFile 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <div className="text-4xl">📄</div>
                <div className="font-medium text-green-700">{selectedFile.name}</div>
                <div className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Datei entfernen
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📎</div>
                <div className="text-gray-600">
                  PDF-Datei hier ablegen oder{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    auswählen
                  </button>
                </div>
                <div className="text-sm text-gray-400">
                  Maximale Dateigröße: 20MB
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
            className="hidden"
          />

          {/* Beschreibung */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Beschreibung (optional)
            </label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="z.B. Original-Lieferschein von DHL..."
              maxLength={500}
            />
            <div className="text-xs text-gray-400 text-right">
              {beschreibung.length}/500 Zeichen
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            disabled={uploading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Uploading...
              </>
            ) : (
              <>
                📤 Hochladen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryNoteUpload;