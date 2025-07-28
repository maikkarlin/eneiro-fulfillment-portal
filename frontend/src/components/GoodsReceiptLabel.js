// frontend/src/components/GoodsReceiptLabel.js
import React from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import './GoodsReceiptLabel.css';

const GoodsReceiptLabel = ({ goodsReceipt, onPrint, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  // QR Code generieren
  React.useEffect(() => {
    const generateQR = async () => {
      try {
        // QR Code Inhalt: WA-ID|Kunde|Datum|Status
        const qrContent = `WA-${goodsReceipt.kWarenannahme}|${goodsReceipt.KundenFirma}|${goodsReceipt.dDatum}|${goodsReceipt.cStatus}`;
        const url = await QRCode.toDataURL(qrContent, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR Code Fehler:', err);
      }
    };
    
    generateQR();
  }, [goodsReceipt]);
  
  const generatePDF = async () => {
    setLoading(true);
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [100, 150] // Etikettengröße 100x150mm
      });
      
      // Hintergrund
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, 150, 100, 'F');
      
      // Rahmen
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(5, 5, 140, 90, 'S');
      
      // Titel
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('WARENANNAHME', 75, 15, { align: 'center' });
      
      // Trennlinie
      pdf.setDrawColor(150, 150, 150);
      pdf.line(10, 20, 140, 20);
      
      // QR Code
      if (qrCodeUrl) {
        pdf.addImage(qrCodeUrl, 'PNG', 10, 25, 35, 35);
      }
      
      // Informationen
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      
      // WA-Nummer (groß)
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`WA-${goodsReceipt.kWarenannahme}`, 50, 30);
      
      // Details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const details = [
        { label: 'Kunde:', value: goodsReceipt.KundenFirma },
        { label: 'Datum:', value: new Date(goodsReceipt.dDatum).toLocaleDateString('de-DE') },
        { label: 'Transporteur:', value: goodsReceipt.cTransporteur },
        { label: 'Packstücke:', value: `${goodsReceipt.nAnzahlPackstuecke}x ${goodsReceipt.cPackstueckArt}` },
        { label: 'Status:', value: goodsReceipt.cStatus }
      ];
      
      let yPos = 40;
      details.forEach(detail => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(detail.label, 50, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(detail.value, 75, yPos);
        yPos += 8;
      });
      
      // JTL-Nummer wenn vorhanden
      if (goodsReceipt.cJTLLieferantenbestellnummer) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`JTL: ${goodsReceipt.cJTLLieferantenbestellnummer}`, 10, 85);
      }
      
      // Mitarbeiter und Zeit
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Erfasst von: ${goodsReceipt.MitarbeiterName} um ${goodsReceipt.tUhrzeit}`, 10, 92);
      
      // PDF speichern/drucken
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Neues Fenster für Druck öffnen
      const printWindow = window.open(pdfUrl, '_blank');
      
      // Automatisch Druckdialog öffnen
      printWindow.onload = () => {
        printWindow.print();
      };
      
      // Callback
      if (onPrint) onPrint();
      
    } catch (err) {
      console.error('PDF Fehler:', err);
      alert('Fehler beim Erstellen des Etiketts');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="label-preview-modal">
      <div className="label-preview-content">
        <div className="label-preview-header">
          <h3>📋 Etikett Vorschau</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="label-preview-body">
          <div className="label-preview-container">
            <div className="label-preview">
              <div className="label-title">WARENANNAHME</div>
              
              <div className="label-content">
                <div className="label-qr">
                  {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" />}
                </div>
                
                <div className="label-info">
                  <div className="label-number">WA-{goodsReceipt.kWarenannahme}</div>
                  
                  <div className="label-details">
                    <div className="label-row">
                      <span className="label-field">Kunde:</span>
                      <span className="label-value">{goodsReceipt.KundenFirma}</span>
                    </div>
                    <div className="label-row">
                      <span className="label-field">Datum:</span>
                      <span className="label-value">
                        {new Date(goodsReceipt.dDatum).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div className="label-row">
                      <span className="label-field">Transporteur:</span>
                      <span className="label-value">{goodsReceipt.cTransporteur}</span>
                    </div>
                    <div className="label-row">
                      <span className="label-field">Packstücke:</span>
                      <span className="label-value">
                        {goodsReceipt.nAnzahlPackstuecke}x {goodsReceipt.cPackstueckArt}
                      </span>
                    </div>
                    <div className="label-row">
                      <span className="label-field">Status:</span>
                      <span className="label-value status">{goodsReceipt.cStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {goodsReceipt.cJTLLieferantenbestellnummer && (
                <div className="label-jtl">JTL: {goodsReceipt.cJTLLieferantenbestellnummer}</div>
              )}
              
              <div className="label-footer">
                Erfasst von: {goodsReceipt.MitarbeiterName} um {goodsReceipt.tUhrzeit}
              </div>
            </div>
          </div>
          
          <div className="label-actions">
            <button 
              className="print-button"
              onClick={generatePDF}
              disabled={loading}
            >
              {loading ? '⏳ Erstelle PDF...' : '🖨️ Etikett drucken'}
            </button>
            <button className="cancel-button" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptLabel;