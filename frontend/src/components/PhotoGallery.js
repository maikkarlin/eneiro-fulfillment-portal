// frontend/src/components/PhotoGallery.js - KOMPLETT KORRIGIERT
import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import './PhotoGallery.css';
import ReactDOM from 'react-dom';

const PhotoGallery = ({ warenannahmeId, mainPhoto }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/goods-receipt/${warenannahmeId}/photos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        const allPhotos = [];
        
        if (mainPhoto) {
          allPhotos.push({
            cDateiPfad: mainPhoto,
            bIstHauptfoto: true,
            nReihenfolge: 1,
            isMainPhoto: true
          });
        }
        
        data.forEach(photo => {
          allPhotos.push({
            ...photo,
            isMainPhoto: false
          });
        });
        
        setPhotos(allPhotos);
        console.log(`📸 ${allPhotos.length} Fotos geladen`);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Fotos:', err);
    } finally {
      setLoading(false);
    }
  }, [warenannahmeId, mainPhoto]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const getPhotoUrl = useCallback((path) => {
    if (!path) return null;
    const cleanPath = path.replace(/\\/g, '/');
    if (cleanPath.startsWith('uploads/')) {
      return `/${cleanPath}`;
    }
    return `/uploads/warenannahme/${cleanPath}`;
  }, []);

  const openLightbox = useCallback((index) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const nextPhoto = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevPhoto = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  if (loading) {
    return <div className="photo-gallery-loading">Lade Fotos...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="photo-gallery-empty">
        <ImageIcon size={48} />
        <p>Keine Fotos vorhanden</p>
      </div>
    );
  }

  return (
    <>
      <div className="photo-gallery">
        <div className="photo-gallery-grid">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="photo-gallery-item"
              onClick={() => openLightbox(index)}
            >
              <img
                src={getPhotoUrl(photo.cDateiPfad)}
                alt={`Foto ${index + 1}`}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.classList.add('photo-error');
                }}
              />
              {photo.isMainPhoto && (
                <div className="photo-badge-main">Hauptfoto</div>
              )}
            </div>
          ))}
        </div>
      </div>

{lightboxOpen && ReactDOM.createPortal(
  <div className="photo-lightbox" onClick={closeLightbox}>
    <button 
      className="lightbox-close" 
      onClick={(e) => {
        e.stopPropagation();
        closeLightbox();
      }}
    >
      <X size={32} />
    </button>

    {photos.length > 1 && (
      <>
        <button 
          className="lightbox-prev" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            prevPhoto(e);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ChevronLeft size={32} />
        </button>

        <button 
          className="lightbox-next" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            nextPhoto(e);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ChevronRight size={32} />
        </button>
      </>
    )}

    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
      <img
        src={getPhotoUrl(photos[currentPhotoIndex].cDateiPfad)}
        alt={`Foto ${currentPhotoIndex + 1}`}
      />
      <div className="lightbox-counter">
        {currentPhotoIndex + 1} / {photos.length}
      </div>
    </div>
  </div>,
  document.body
)}
    </>
  );
};

export default PhotoGallery;