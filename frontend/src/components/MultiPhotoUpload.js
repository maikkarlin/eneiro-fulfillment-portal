// frontend/src/components/MultiPhotoUpload.js - NEUE KOMPONENTE
import React, { useState } from 'react';
import { Camera, X, Upload, Image as ImageIcon, Trash2, Star } from 'lucide-react';
import './MultiPhotoUpload.css';

const MultiPhotoUpload = ({ 
  warenannahmeId, 
  onPhotosUploaded,
  maxPhotos = 10 
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');

  // Bild-Komprimierung (wie in GoodsReceiptForm)
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
                  file.name.replace(/\.(png|jpg|jpeg|gif|heic|heif)$/i, '.jpg'),
                  { type: 'image/jpeg', lastModified: Date.now() }
                );
                
                console.log('Original:', (file.size / 1024 / 1024).toFixed(2), 'MB');
                console.log('Komprimiert:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
                
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

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    if (selectedFiles.length + files.length > maxPhotos) {
      setError(`Maximal ${maxPhotos} Fotos erlaubt`);
      return;
    }

    setError('');
    setCompressing(true);

    try {
      const processedFiles = [];
      const newPreviews = [];

      for (const file of files) {
        const fileSizeMB = file.size / 1024 / 1024;
        
        let finalFile = file;
        if (fileSizeMB > 2) {
          console.log('Komprimiere:', file.name);
          finalFile = await compressImage(file);
        }

        processedFiles.push(finalFile);

        // Preview erstellen
        const reader = new FileReader();
        const previewPromise = new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(finalFile);
        });
        
        const previewUrl = await previewPromise;
        newPreviews.push({ file: finalFile, preview: previewUrl });
      }

      setSelectedFiles([...selectedFiles, ...processedFiles]);
      setPreviews([...previews, ...newPreviews]);

    } catch (err) {
      console.error('Fehler beim Verarbeiten:', err);
      setError('Fehler beim Verarbeiten der Fotos');
    } finally {
      setCompressing(false);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Bitte wählen Sie mindestens ein Foto aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      
      selectedFiles.forEach((file) => {
        formData.append('photos', file);
      });

      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/photos/warenannahme/${warenannahmeId}/upload`, {
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

      const result = await response.json();
      console.log('Upload erfolgreich:', result);

      // Reset
      setSelectedFiles([]);
      setPreviews([]);

      if (onPhotosUploaded) {
        onPhotosUploaded(result.photos);
      }

      alert(`${result.photos.length} Foto(s) erfolgreich hochgeladen!`);

    } catch (err) {
      console.error('Upload-Fehler:', err);
      setError(err.message || 'Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="multi-photo-upload">
      <div className="upload-header">
        <h3>Weitere Fotos hinzufügen</h3>
        <p>Maximal {maxPhotos} Fotos - werden automatisch optimiert</p>
      </div>

      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}

      {compressing && (
        <div className="upload-info">
          <Upload size={16} />
          Bilder werden komprimiert... Bitte warten.
        </div>
      )}

      {/* Selected Photos Preview */}
      {previews.length > 0 && (
        <div className="preview-grid">
          {previews.map((item, index) => (
            <div key={index} className="preview-item">
              <img src={item.preview} alt={`Preview ${index + 1}`} />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="remove-preview-btn"
                disabled={uploading}
              >
                <X size={16} />
              </button>
              {index === 0 && (
                <div className="main-photo-badge">
                  <Star size={14} /> Hauptfoto
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Buttons */}
      <div className="upload-actions">
        {selectedFiles.length < maxPhotos && (
          <>
            <label className="upload-btn camera-btn">
              <Camera size={20} />
              <span>Kamera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={uploading || compressing}
              />
            </label>

            <label className="upload-btn gallery-btn">
              <ImageIcon size={20} />
              <span>Galerie</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={uploading || compressing}
              />
            </label>
          </>
        )}

        {selectedFiles.length > 0 && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || compressing}
            className="upload-btn submit-btn"
          >
            {uploading ? (
              <>
                <div className="spinner"></div>
                Hochladen...
              </>
            ) : (
              <>
                <Upload size={20} />
                {selectedFiles.length} Foto(s) hochladen
              </>
            )}
          </button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="upload-hint">
          Das erste Foto wird als Hauptfoto verwendet
        </div>
      )}
    </div>
  );
};

export default MultiPhotoUpload;