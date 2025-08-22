// frontend/src/components/Dashboard.js - MIT DOKUMENT-FEATURES ERWEITERT
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  FileText, 
  LogOut, 
  Menu,
  TrendingUp,
  Clock,
  DollarSign,
  Truck,
  ClipboardList,
  Plus,
  Eye,
  Users,
  CheckCircle,
  AlertCircle,
  Camera,
  Image,
  X,
  Search,
  Filter,
  Printer
} from 'lucide-react';
import { dashboardAPI, goodsReceiptAPI } from '../services/api';
import GoodsReceiptForm from './GoodsReceiptForm';
import GoodsReceiptDetailsModal from './GoodsReceiptDetailsModal';
import GoodsReceiptLabel from './GoodsReceiptLabel';
import CustomerGoodsReceipts from './CustomerGoodsReceipts';
import DocumentsDisplay from './DocumentsDisplay'; // ✅ NEU: Import DocumentsDisplay
import Blocklager from './Blocklager';
import ItemizedRecords from './ItemizedRecords';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState({});
  const [goodsReceiptData, setGoodsReceiptData] = useState({ list: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState(null);
  const [selectedGoodsReceipt, setSelectedGoodsReceipt] = useState(null);
  const [labelPrintData, setLabelPrintData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (user?.role === 'customer') {
        const [kpis, orders] = await Promise.all([
          dashboardAPI.getKPIs(),
          dashboardAPI.getOrdersHistory()
        ]);
        
        setData({
          kpis: kpis.data,
          orders: orders.data
        });
      } else if (user?.role === 'employee') {
        console.log('🔄 Lade Mitarbeiter-Dashboard Daten...');
        
        try {
          const [goodsReceipts, goodsReceiptStats] = await Promise.all([
            goodsReceiptAPI.getAll(),
            goodsReceiptAPI.getStats()
          ]);
          
          console.log('📦 Goods Receipts Response:', goodsReceipts.data);
          console.log('📊 Stats Response:', goodsReceiptStats.data);
          
          const list = goodsReceipts.data?.data || goodsReceipts.data || [];
          const stats = goodsReceiptStats.data || {};
          
          console.log('✅ Extrahierte Liste:', list.length, 'Einträge');
          console.log('✅ Extrahierte Stats:', stats);
          
          setGoodsReceiptData({
            list: Array.isArray(list) ? list : [],
            stats: stats
          });
          
        } catch (apiError) {
          console.error('❌ API Fehler:', apiError);
          setGoodsReceiptData({
            list: [],
            stats: {}
          });
          setError('Fehler beim Laden der Warenannahme-Daten: ' + apiError.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Allgemeiner Fehler beim Laden der Dashboard-Daten:', error);
      setError('Fehler beim Laden der Daten: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getNavigationItems = () => {
    if (user?.role === 'employee') {
      return [
        { id: 'overview', label: 'Übersicht', icon: BarChart3 },
        { id: 'goods-receipt', label: 'Warenannahmen', icon: ClipboardList },
        { id: 'goods-receipt-add', label: 'Erfassen', icon: Plus },
        { id: 'blocklager', label: 'Blocklager', icon: Package }
      ];
    } else {
      return [
        { id: 'overview', label: 'Übersicht', icon: BarChart3 },
        { id: 'goods-receipts', label: 'Warenannahmen', icon: Package },
        { id: 'itemized', label: 'Einzelverbindungsnachweis', icon: FileText }
      ];
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <p>Lade Dashboard...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={loadDashboardData} className="retry-button">
            Erneut versuchen
          </button>
        </div>
      );
    }

    if (user?.role === 'employee') {
      switch (activeSection) {
        case 'overview':
          return <EmployeeOverview data={goodsReceiptData} onRefresh={loadDashboardData} />;
        case 'goods-receipt':
          return (
            <GoodsReceiptList 
              data={goodsReceiptData} 
              onRefresh={loadDashboardData} 
              onPhotoClick={setPhotoModal}
              onDetailsClick={setSelectedGoodsReceipt}
              onLabelPrint={setLabelPrintData}
            />
          );
        case 'goods-receipt-add':
          return <GoodsReceiptForm onSuccess={loadDashboardData} />;
        case 'blocklager':
          return <Blocklager />;
        default:
          return <EmployeeOverview data={goodsReceiptData} onRefresh={loadDashboardData} />;
      }
    }

    switch (activeSection) {
      case 'overview':
        return <CustomerOverview data={data} onRefresh={loadDashboardData} />;
      case 'goods-receipts':
        return <CustomerGoodsReceipts />;
      case 'itemized':
        return <ItemizedRecords />;
      default:
        return <CustomerOverview data={data} onRefresh={loadDashboardData} />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              className="menu-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={24} />
            </button>
            <img 
              src="/logo192.png" 
              alt="Logo" 
              className="logo"
            />
            <div className="divider"></div>
            <h1>Fulfillment Portal</h1>
          </div>
          <div className="header-right">
            <div className="user-info">
              <div className="user-details">
                <span className="user-name">
                  {user?.role === 'employee' ? user.name : (user?.company || user?.name)}
                </span>
                <span className="user-number">
                  {user?.role === 'employee' 
                    ? `👤 ${user.login}` 
                    : `🏢 ${user?.customerNumber}`
                  }
                </span>
                <span className="user-role">
                  {user?.role === 'employee' ? 'Mitarbeiter' : 'Kunde'}
                </span>
              </div>
              <button onClick={onLogout} className="logout-button">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="nav-menu">
            {getNavigationItems().map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      {photoModal && (
        <PhotoModal 
          photoPath={photoModal} 
          onClose={() => setPhotoModal(null)} 
        />
      )}
      
      {selectedGoodsReceipt && (
        <GoodsReceiptDetailsModal
          goodsReceiptId={selectedGoodsReceipt.kWarenannahme}
          onClose={() => setSelectedGoodsReceipt(null)}
          onUpdate={() => {
            setSelectedGoodsReceipt(null);
            loadDashboardData();
          }}
          onPhotoClick={setPhotoModal}
        />
      )}
      
      {labelPrintData && (
        <GoodsReceiptLabel
          goodsReceipt={labelPrintData}
          onPrint={() => {
            console.log('Etikett gedruckt für:', labelPrintData);
            setLabelPrintData(null);
          }}
          onClose={() => setLabelPrintData(null)}
        />
      )}
    </div>
  );
};

// ===== REPARIERTE FOTO-MODAL KOMPONENTE =====
const PhotoModal = ({ photoPath, onClose }) => {
  console.log('🖼️ PhotoModal - Foto-Pfad:', photoPath);
  
  // Korrekte URL konstruieren
  const getPhotoUrl = (path) => {
    if (!path) return null;
    
    // Backslashes durch Slashes ersetzen
    const cleanPath = path.replace(/\\/g, '/');
    
    // Wenn bereits mit "uploads/" beginnt, direkt verwenden
    if (cleanPath.startsWith('uploads/')) {
      return `http://localhost:5000/${cleanPath}`;
    }
    
    // Ansonsten "uploads/warenannahme/" voranstellen
    return `http://localhost:5000/uploads/warenannahme/${cleanPath}`;
  };
  
  const photoUrl = getPhotoUrl(photoPath);
  console.log('🔗 Generierte Foto-URL:', photoUrl);
  
  if (!photoUrl) {
    return (
      <div className="photo-modal-overlay" onClick={onClose}>
        <div className="photo-modal-content">
          <button className="photo-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>❌ Foto nicht verfügbar</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        <img 
          src={photoUrl}
          alt="Warenannahme Foto" 
          className="photo-modal-image"
          onLoad={() => console.log('✅ Foto geladen:', photoUrl)}
          onError={(e) => {
            console.error('❌ Foto-Fehler:', photoUrl);
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML += `
              <div style="padding: 20px; text-align: center;">
                <p>❌ Foto konnte nicht geladen werden</p>
                <p>URL: ${photoUrl}</p>
              </div>
            `;
          }}
        />
      </div>
    </div>
  );
};

// Mitarbeiter-Komponenten
const EmployeeOverview = ({ data, onRefresh }) => (
  <div>
    <div className="section-header">
      <h2>Mitarbeiter Dashboard</h2>
      <button onClick={onRefresh} className="refresh-button">🔄 Aktualisieren</button>
    </div>
    
    {data.stats && (
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-info">
              <h3>Heutige Anlieferungen</h3>
              <div className="kpi-value">{data.stats.heutigeAnlieferungen || 0}</div>
              <div className="kpi-subtitle">Anlieferungen heute</div>
            </div>
            <div className="kpi-icon">
              <ClipboardList size={24} />
            </div>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-info">
              <h3>Offene Einlagerungen</h3>
              <div className="kpi-value">{data.stats.offeneEinlagerungen || 0}</div>
              <div className="kpi-subtitle">Warten auf Einlagerung</div>
            </div>
            <div className="kpi-icon">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-info">
              <h3>In Bearbeitung</h3>
              <div className="kpi-value">{data.stats.inBearbeitung || 0}</div>
              <div className="kpi-subtitle">Werden eingelagert</div>
            </div>
            <div className="kpi-icon">
              <Package size={24} />
            </div>
          </div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-info">
              <h3>Gesamte Packstücke</h3>
              <div className="kpi-value">{data.stats.gesamtPackstuecke || 0}</div>
              <div className="kpi-subtitle">Letzter Monat</div>
            </div>
            <div className="kpi-icon">
              <Truck size={24} />
            </div>
          </div>
        </div>
      </div>
    )}
    
    <div className="recent-activities">
      <h3>Neueste Warenannahmen</h3>
      {data.list && Array.isArray(data.list) && data.list.length > 0 ? (
        <div className="activity-list">
          {data.list.slice(0, 5).map((item) => (
            <div key={item.kWarenannahme} className="activity-item">
              <Clock size={16} />
              <span>
                {new Date(item.dDatum).toLocaleDateString()} - 
                {item.nAnzahlPackstuecke} {item.cPackstueckArt} 
                für {item.KundenFirma} ({item.cStatus})
              </span>
              {item.cFotoPath && (
                <Camera size={14} className="photo-indicator" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Keine Warenannahmen vorhanden</p>
      )}
    </div>
  </div>
);

// ✅ ERWEITERTE Warenannahmen-Liste MIT DOKUMENT-FEATURES
const GoodsReceiptList = ({ data, onRefresh, onPhotoClick, onDetailsClick, onLabelPrint }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [filteredData, setFilteredData] = useState([]);
  const [documentCounts, setDocumentCounts] = useState({}); // ✅ NEU: State für Dokument-Anzahlen

  // ✅ NEU: Funktion zum Laden der Dokument-Anzahl für eine Warenannahme
  const loadDocumentCount = async (warenannahmeId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/documents/warenannahme/${warenannahmeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data.length : 0;
      }
      return 0;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dokument-Anzahl:', error);
      return 0;
    }
  };

  // ✅ NEU: Effect zum Laden aller Dokument-Anzahlen
  useEffect(() => {
    const loadAllDocumentCounts = async () => {
      if (!data.list || !Array.isArray(data.list)) return;
      
      console.log('📊 Lade Dokument-Anzahlen für Mitarbeiter...');
      const counts = {};
      
      for (const item of data.list) {
        if (item.kWarenannahme) {
          const count = await loadDocumentCount(item.kWarenannahme);
          counts[item.kWarenannahme] = count;
        }
      }
      
      setDocumentCounts(counts);
      console.log('✅ Dokument-Anzahlen geladen:', counts);
    };
    
    loadAllDocumentCounts();
  }, [data.list]);

  useEffect(() => {
    if (!data.list || !Array.isArray(data.list)) {
      setFilteredData([]);
      return;
    }

    let filtered = [...data.list];

    if (searchTerm) {
      filtered = filtered.filter(item => 
        (item.kWarenannahme && item.kWarenannahme.toString().includes(searchTerm)) ||
        (item.KundenFirma && item.KundenFirma.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.cTransporteur && item.cTransporteur.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== 'alle') {
      filtered = filtered.filter(item => item.cStatus === statusFilter);
    }

    setFilteredData(filtered);
  }, [data.list, searchTerm, statusFilter]);

  if (!data.list || !Array.isArray(data.list)) {
    return (
      <div>
        <div className="section-header">
          <h2>Warenannahmen Übersicht</h2>
          <button onClick={onRefresh} className="refresh-button">🔄 Aktualisieren</button>
        </div>
        <div className="error-container">
          <p>⚠️ Fehler beim Laden der Warenannahmen.</p>
          <button onClick={onRefresh} className="retry-button">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2>Warenannahmen Übersicht</h2>
        <button onClick={onRefresh} className="refresh-button">🔄 Aktualisieren</button>
      </div>
      
      {/* Such- und Filterbereich */}
      <div className="search-filter-container" style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '20px',
        padding: '16px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={20} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#666'
          }} />
          <input
            type="text"
            placeholder="Suche nach ID, Kunde oder Transporteur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 40px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={20} style={{ color: '#666' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="alle">Alle Status</option>
            <option value="Eingegangen">Eingegangen</option>
            <option value="In Einlagerung">In Einlagerung</option>
            <option value="Eingelagert">Eingelagert</option>
          </select>
        </div>
      </div>
      
      {(searchTerm || statusFilter !== 'alle') && (
        <div style={{
          marginBottom: '16px',
          padding: '8px 16px',
          background: '#f0f0f0',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#666'
        }}>
          {filteredData.length} von {data.list.length} Einträgen gefunden
        </div>
      )}
      
      {filteredData.length > 0 ? (
        <div className="goods-receipt-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Datum</th>
                <th>Kunde</th>
                <th>Transporteur</th>
                <th>Packstücke</th>
                <th>Status</th>
                <th>Dokumente</th> {/* ✅ NEU: Dokumente Spalte */}
                <th>Foto</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => {
                const docCount = documentCounts[item.kWarenannahme] || 0; // ✅ NEU: Dokument-Anzahl abrufen
                
                return (
                  <tr key={item.kWarenannahme}>
                    <td style={{ fontWeight: 'bold', color: '#1976d2' }}>
                      WA-{item.kWarenannahme}
                    </td>
                    <td>{new Date(item.dDatum).toLocaleDateString()}</td>
                    <td>{item.KundenFirma || 'Unbekannt'}</td>
                    <td>{item.cTransporteur || 'Unbekannt'}</td>
                    <td>{item.nAnzahlPackstuecke} {item.cPackstueckArt}</td>
                    <td>
                      <span className={`status-badge ${item.cStatus.toLowerCase().replace(' ', '-')}`}>
                        {item.cStatus}
                      </span>
                    </td>
                    {/* ✅ NEU: Dokumente Spalte mit Counter */}
                    <td>
                      {docCount > 0 ? (
                        <span className="documents-count-badge">
                          📄 {docCount}
                        </span>
                      ) : (
                        <span className="no-documents">Keine</span>
                      )}
                    </td>
                    <td>
                      {item.cFotoPath ? (
                        <button 
                          onClick={() => {
                            console.log('🖱️ Foto-Button geklickt, Pfad:', item.cFotoPath);
                            onPhotoClick(item.cFotoPath);
                          }}
                          className="photo-button"
                          title="Foto anzeigen"
                        >
                          <Image size={16} />
                        </button>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '12px' }}>Kein Foto</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => onDetailsClick(item)}
                          className="action-button"
                          title="Details anzeigen"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => onLabelPrint(item)}
                          className="action-button print-button"
                          title="Etikett drucken"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Package size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
          <h3>Keine Warenannahmen gefunden</h3>
          <p>
            {searchTerm || statusFilter !== 'alle' 
              ? 'Keine Ergebnisse für die aktuelle Filterung'
              : 'Noch keine Warenannahmen vorhanden'
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Kunden-Komponenten
const CustomerOverview = ({ data, onRefresh }) => {
  if (!data.kpis) {
    return (
      <div>
        <div className="section-header">
          <h2>Dashboard</h2>
          <button onClick={onRefresh} className="refresh-button">🔄 Aktualisieren</button>
        </div>
        <p>Lade Daten...</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Bestellungen diesen Monat',
      value: data.kpis.totalOrders || 0,
      icon: Package,
      trend: data.kpis.ordersTrend,
      color: '#2563eb',
      bgColor: '#dbeafe'
    },
    {
      label: 'Bestellungen heute',
      value: data.kpis.ordersToday || 0,
      icon: Clock,
      color: '#7c3aed',
      bgColor: '#ede9fe'
    },
    {
      label: 'Offene Sendungen',
      value: data.kpis.pendingShipments || 0,
      icon: Truck,
      color: '#dc2626',
      bgColor: '#fecaca'
    },
    {
      label: 'Versendete Pakete',
      value: data.kpis.packagesShipped || 0,
      icon: Package,
      color: '#0891b2',
      bgColor: '#cffafe'
    }
  ];

  return (
    <div>
      <div className="section-header">
        <h2>Dashboard</h2>
        <button onClick={onRefresh} className="refresh-button">🔄 Aktualisieren</button>
      </div>
      
      <div className="kpi-grid">
        {kpiCards.map((kpi, index) => (
          <div key={index} className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-info">
                <p className="kpi-label">{kpi.label}</p>
                <h3 className="kpi-value">{kpi.value}</h3>
                {kpi.trend !== undefined && (
                  <p className={`kpi-trend ${kpi.trend > 0 ? 'positive' : kpi.trend < 0 ? 'negative' : 'neutral'}`}>
                    {kpi.trend > 0 ? '↗' : kpi.trend < 0 ? '↘' : '→'}
                    {Math.abs(kpi.trend)}% vs. Vormonat
                  </p>
                )}
              </div>
              <div 
                className="kpi-icon" 
                style={{ 
                  backgroundColor: kpi.bgColor,
                  color: kpi.color,
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <kpi.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;