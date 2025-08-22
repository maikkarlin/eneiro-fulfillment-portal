import React, { useState, useEffect } from 'react';

const DocumentsDisplay = ({ 
  warenannahmeId, 
  userRole, 
  onDocumentCountChange, 
  onUploadClick 
}) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/documents/warenannahme/${warenannahmeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Dokumente');
      }

      const data = await response.json();
      setDocuments(data);
      
      // Anzahl-Update für Parent-Komponente
      if (onDocumentCountChange) {
        onDocumentCountChange(data.length);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Dokumente:', err);
      setError('Fehler beim Laden der Dokumente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (warenannahmeId) {
      loadDocuments();
    }
  }, [warenannahmeId]);

  const handleOpenPdf = async (dokumentId, dokumentName) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/documents/download/${dokumentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Fehler beim Laden des Dokuments');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // URL nach kurzer Zeit freigeben
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Fehler beim Öffnen der PDF:', err);
      alert('Fehler beim Öffnen des Dokuments: ' + err.message);
    }
  };

  const handleDownload = async (dokumentId, dokumentName) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/documents/download/${dokumentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Fehler beim Download');
      }

      const blob = await response.blob();
      
      // Download-Link erstellen
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dokumentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Fehler beim Download:', err);
      alert('Fehler beim Download: ' + err.message);
    }
  };

  const handleDelete = async (dokumentId) => {
    if (!window.confirm('Soll dieses Dokument wirklich gelöscht werden?')) {
      return;
    }

    try {
      setDeletingId(dokumentId);
      
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/documents/${dokumentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Löschen');
      }

      await loadDocuments(); // Neu laden
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Reload documents when needed
  const reloadDocuments = () => {
    loadDocuments();
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-gray-600">Lade Dokumente...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Upload Button (ohne doppelten Titel) */}
      {userRole === 'employee' && onUploadClick && (
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => onUploadClick(reloadDocuments)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            📤 Lieferschein hochladen
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📄</div>
            <div className="text-lg font-medium mb-1">Keine Dokumente vorhanden</div>
            <div className="text-sm">
              {userRole === 'employee' 
                ? 'Klicken Sie auf "Lieferschein hochladen" um ein Dokument hinzuzufügen.'
                : 'Sobald Dokumente verfügbar sind, werden sie hier angezeigt.'
              }
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.kDokument}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                style={{ borderLeft: '3px solid #667eea' }}
              >
                {/* Dateiname - Prominent */}
                <div className="mb-3">
                  <div 
                    className="text-white font-semibold text-sm px-3 py-2 rounded text-center"
                    style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      wordBreak: 'break-word'
                    }}
                  >
                    {doc.cDateiName}
                  </div>
                </div>

                {/* Meta-Informationen - Strukturiert */}
                <div className="mb-4 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {/* Dateityp Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      📄 {doc.cDokumentTyp || 'Lieferschein'}
                    </span>
                    
                    {/* Größe Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      📊 {formatFileSize(doc.nDateiGroesse)}
                    </span>
                    
                    {/* Datum Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                      📅 {formatDate(doc.dErstellt)}
                    </span>
                  </div>
                  
                  {/* Uploader - Separate Zeile */}
                  {doc.HochgeladenVon && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span>👤</span>
                      <span>Hochgeladen von <strong>{doc.HochgeladenVon}</strong></span>
                    </div>
                  )}
                </div>

                {/* Beschreibung */}
                {doc.cBeschreibung && (
                  <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-600 italic">
                    "{doc.cBeschreibung}"
                  </div>
                )}

                {/* Actions - Kompakte Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  {/* PDF öffnen */}
                  <button
                    onClick={() => handleOpenPdf(doc.kDokument, doc.cDateiName)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 transition-colors flex items-center gap-1"
                    title="PDF öffnen"
                  >
                    👁️ Öffnen
                  </button>

                  {/* Download */}
                  <button
                    onClick={() => handleDownload(doc.kDokument, doc.cDateiName)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                    title="Herunterladen"
                  >
                    📥 Download
                  </button>

                  {/* Löschen (nur für Mitarbeiter) */}
                  {userRole === 'employee' && (
                    <button
                      onClick={() => handleDelete(doc.kDokument)}
                      disabled={deletingId === doc.kDokument}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Löschen"
                    >
                      {deletingId === doc.kDokument ? (
                        <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                      ) : (
                        '🗑️'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsDisplay;