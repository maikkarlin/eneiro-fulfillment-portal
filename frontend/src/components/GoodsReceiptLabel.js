// frontend/src/components/GoodsReceiptLabel.js
import React from 'react';
import JsBarcode from 'jsbarcode'; // Neue Library für EAN128/Code128
import jsPDF from 'jspdf';
import './GoodsReceiptLabel.css';

const GoodsReceiptLabel = ({ goodsReceipt, onPrint, onClose }) => {
  const [barcodeUrl, setBarcodeUrl] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  // EAN128 Barcode generieren
  React.useEffect(() => {
    const generateBarcode = async () => {
      try {
        // Canvas Element erstellen
        const canvas = document.createElement('canvas');
        
        // ID für Barcode (z.B. "WA-11")
        const barcodeText = `WA-${goodsReceipt.kWarenannahme}`;

        console.log('🔍 BARCODE DEBUG:', barcodeText, 'JsBarcode geladen:', typeof JsBarcode);
        
        // EAN128/Code128 Barcode generieren
        JsBarcode(canvas, barcodeText, {
          format: "CODE128", // EAN128 basiert auf Code128
          width: 2,
          height: 80,
          displayValue: true, // Text unter dem Barcode anzeigen
          fontSize: 14,
          textMargin: 8,
          margin: 10,
          background: "#FFFFFF",
          lineColor: "#000000"
        });
        
        // Canvas zu Data URL konvertieren
        const dataUrl = canvas.toDataURL('image/png');
        setBarcodeUrl(dataUrl);
        
      } catch (err) {
        console.error('Barcode Fehler:', err);
        // Fallback: Text anzeigen wenn Barcode fehlschlägt
        setBarcodeUrl('');
      }
    };
    
    generateBarcode();
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
      
      // Barcode (falls vorhanden)
      if (barcodeUrl) {
        pdf.addImage(barcodeUrl, 'PNG', 10, 25, 60, 25); // Breiterer Barcode
      }
      
      // Informationen (rechts neben dem Barcode)
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      
      // WA-Nummer (groß) - rechts vom Barcode
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`WA-${goodsReceipt.kWarenannahme}`, 80, 30);
      
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
        pdf.text(detail.label, 80, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(detail.value, 105, yPos);
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
              <div className="label-title">WARENANNAHME BARCODE VERSION v2</div>
              
              <div className="label-content">
                <div className="label-barcode">
                  {barcodeUrl ? (
                    <img src={barcodeUrl} alt="EAN128 Barcode" />
                  ) : (
                    <div className="barcode-fallback">
                      <div className="barcode-text">WA-{goodsReceipt.kWarenannahme}</div>
                      <div className="barcode-info">Barcode wird generiert...</div>
                    </div>
                  )}
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
