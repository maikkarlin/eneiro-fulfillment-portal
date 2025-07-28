// frontend/src/components/Dashboard.js - MIT ETIKETTENDRUCK UND SUCHE/FILTER UND KUNDEN-WARENANNAHMEN
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
  // NEU für Mitarbeiter:
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
  Filter
} from 'lucide-react';
import { dashboardAPI, goodsReceiptAPI } from '../services/api';
import GoodsReceiptForm from './GoodsReceiptForm';
import GoodsReceiptDetailsModal from './GoodsReceiptDetailsModal';
import GoodsReceiptLabel from './GoodsReceiptLabel'; // NEU: Import für Etikettendruck
import CustomerGoodsReceipts from './CustomerGoodsReceipts'; // NEU: Import für Kunden-Warenannahmen
import ItemizedRecords from './ItemizedRecords'; // ORIGINAL KOMPONENTE
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState({});
  const [goodsReceiptData, setGoodsReceiptData] = useState({});
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState(null);
  const [selectedGoodsReceipt, setSelectedGoodsReceipt] = useState(null); // NEU: für Details-Modal
  const [labelPrintData, setLabelPrintData] = useState(null); // NEU: für Etikettendruck
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (user?.role === 'customer') {
        // ORIGINAL Kunden-Dashboard
        const [kpis, orders] = await Promise.all([
          dashboardAPI.getKPIs(),
          dashboardAPI.getOrdersHistory()
        ]);
        
        setData({
          kpis: kpis.data,
          orders: orders.data
        });
      } else if (user?.role === 'employee') {
        // Mitarbeiter-Dashboard
        const [goodsReceipts, goodsReceiptStats] = await Promise.all([
          goodsReceiptAPI.getAll(),
          goodsReceiptAPI.getStats()
        ]);
        
        setGoodsReceiptData({
          list: goodsReceipts.data,
          stats: goodsReceiptStats.data
        });
      }
      
    } catch (error) {
      console.error('Fehler beim Laden der Dashboard-Daten:', error);
      setError('Fehler beim Laden der Daten: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigation items basierend auf Benutzerrolle
  const getNavigationItems = () => {
    if (user?.role === 'employee') {
      return [
        { 
          id: 'overview', 
          label: 'Übersicht', 
          icon: BarChart3 
        },
        { 
          id: 'goods-receipt', 
          label: 'Warenannahmen', 
          icon: ClipboardList 
        },
        { 
          id: 'goods-receipt-add', 
          label: 'Erfassen', 
          icon: Plus 
        },
        { 
          id: 'inventory', 
          label: 'Lagerbestand', 
          icon: Package 
        },
        { 
          id: 'customers', 
          label: 'Kunden', 
          icon: Users 
        }
      ];
    } else {
      // ERWEITERTE Kunde Navigation
      return [
        { 
          id: 'overview', 
          label: 'Übersicht', 
          icon: BarChart3 
        },
        { 
          id: 'goods-receipts',  // NEU
          label: 'Warenannahmen', // NEU
          icon: Package // NEU
        },
        { 
          id: 'itemized', 
          label: 'Einzelverbindungsnachweis', 
          icon: FileText 
        },
        { 
          id: 'orders', 
          label: 'Bestellungen', 
          icon: Package 
        },
        { 
          id: 'reports', 
          label: 'Berichte', 
          icon: TrendingUp 
        }
      ];
    }
  };

  // ORIGINAL KPI Cards Funktion
  const getKPICards = () => {
    if (!data.kpis) return [];
    
    const kpis = data.kpis;
    
    return [
      {
        label: 'Bestellungen diesen Monat',
        value: kpis.totalOrders || 0,
        icon: Package,
        trend: kpis.ordersTrend,
        color: '#2563eb',
        bgColor: '#dbeafe'
      },
      {
        label: 'Bestellungen heute',
        value: kpis.ordersToday || 0,
        icon: Clock,
        color: '#7c3aed',
        bgColor: '#ede9fe'
      },
      {
        label: 'Offene Sendungen',
        value: kpis.pendingShipments || 0,
        icon: Truck,
        color: '#dc2626',
        bgColor: '#fecaca'
      },
      {
        label: 'Umsatz diesen Monat',
        value: `€${(kpis.revenue || 0).toFixed(2)}`,
        icon: DollarSign,
        color: '#059669',
        bgColor: '#d1fae5'
      },
      {
        label: 'Versendete Pakete',
        value: kpis.packagesShipped || 0,
        icon: Package,
        color: '#0891b2',
        bgColor: '#cffafe'
      },
      {
        label: 'Retourenquote',
        value: `${kpis.returnRate || 0}%`,
        icon: TrendingUp,
        color: '#c2410c',
        bgColor: '#ffedd5'
      }
    ];
  };

  const getTrendClass = (trend) => {
    if (trend > 0) return 'positive';
    if (trend < 0) return 'negative';
    return 'neutral';
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return '↗';
    if (trend < 0) return '↘';
    return '→';
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

    // === MITARBEITER CONTENT ===
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
        case 'inventory':
          return <InventoryView />;
        case 'customers':
          return <CustomersView />;
        default:
          return <EmployeeOverview data={goodsReceiptData} onRefresh={loadDashboardData} />;
      }
    }

    // === ERWEITERTE KUNDEN CONTENT ===
    switch (activeSection) {
      case 'overview':
        return <CustomerOverview data={data} onRefresh={loadDashboardData} />;
      case 'goods-receipts':  // NEU
        return <CustomerGoodsReceipts />; // NEU
      case 'itemized':
        return <ItemizedRecords />; // ORIGINAL KOMPONENTE
      case 'orders':
        return <OrdersView data={data} />;
      case 'reports':
        return <ReportsView />;
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
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          <div className="dashboard-content">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Foto-Modal */}
      {photoModal && (
        <PhotoModal 
          photoPath={photoModal} 
          onClose={() => setPhotoModal(null)} 
        />
      )}

      {/* Details-Modal NEU */}
      {selectedGoodsReceipt && (
        <GoodsReceiptDetailsModal
          goodsReceiptId={selectedGoodsReceipt}
          onClose={() => setSelectedGoodsReceipt(null)}
          onUpdate={loadDashboardData}
          onPhotoClick={setPhotoModal}
        />
      )}

      {/* Etiketten-Modal NEU */}
      {labelPrintData && (
        <GoodsReceiptLabel
          goodsReceipt={labelPrintData}
          onPrint={() => {
            alert('Etikett wurde zum Drucker gesendet!');
            setLabelPrintData(null);
          }}
          onClose={() => setLabelPrintData(null)}
        />
      )}
    </div>
  );
};

// === FOTO-MODAL KOMPONENTE ===
const PhotoModal = ({ photoPath, onClose }) => (
  <div className="photo-modal-overlay" onClick={onClose}>
    <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
      <button className="photo-modal-close" onClick={onClose}>
        <X size={24} />
      </button>
      <img 
        src={`http://localhost:5000/${photoPath.replace(/\\/g, '/')}`} 
        alt="Warenannahme Foto" 
        className="photo-modal-image"
      />
    </div>
  </div>
);

// === ORIGINAL KUNDEN KOMPONENTEN ===
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
      label: 'Umsatz diesen Monat',
      value: `€${(data.kpis.revenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: '#059669',
      bgColor: '#d1fae5'
    },
    {
      label: 'Versendete Pakete',
      value: data.kpis.packagesShipped || 0,
      icon: Package,
      color: '#0891b2',
      bgColor: '#cffafe'
    },
    {
      label: 'Retourenquote',
      value: `${data.kpis.returnRate || 0}%`,
      icon: TrendingUp,
      color: '#c2410c',
      bgColor: '#ffedd5'
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
                  color: kpi.color 
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

const OrdersView = ({ data }) => (
  <div>
    <div className="section-header">
      <h2>Bestellungen</h2>
    </div>
    <p>Bestellübersicht wird hier angezeigt...</p>
  </div>
);

const ReportsView = () => (
  <div>
    <div className="section-header">
      <h2>Berichte</h2>
    </div>
    <p>Berichte werden hier angezeigt...</p>
  </div>
);

// === MITARBEITER KOMPONENTEN ===
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
            <h3>Heutige Anlieferungen</h3>
            <ClipboardList className="kpi-icon" />
          </div>
          <div className="kpi-value">{data.stats.HeutigeAnlieferungen || 0}</div>
          <div className="kpi-subtitle">Anlieferungen heute</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Offene Einlagerungen</h3>
            <AlertCircle className="kpi-icon" />
          </div>
          <div className="kpi-value">{data.stats.OffeneEinlagerungen || 0}</div>
          <div className="kpi-subtitle">Warten auf Einlagerung</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>In Bearbeitung</h3>
            <Package className="kpi-icon" />
          </div>
          <div className="kpi-value">{data.stats.InBearbeitung || 0}</div>
          <div className="kpi-subtitle">Werden eingelagert</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-header">
            <h3>Gesamte Packstücke</h3>
            <Truck className="kpi-icon" />
          </div>
          <div className="kpi-value">{data.stats.GesamtPackstuecke || 0}</div>
          <div className="kpi-subtitle">Letzter Monat</div>
        </div>
      </div>
    )}
    
    <div className="recent-activities">
      <h3>Neueste Warenannahmen</h3>
      {data.list && data.list.length > 0 ? (
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

// ERWEITERTE GoodsReceiptList MIT SUCHE UND FILTER
const GoodsReceiptList = ({ data, onRefresh, onPhotoClick, onDetailsClick, onLabelPrint }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [filteredData, setFilteredData] = useState([]);

  // Filter-Logik
  useEffect(() => {
    if (!data.list) {
      setFilteredData([]);
      return;
    }

    let filtered = [...data.list];

    // Suchfilter (ID oder Kunde)
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.kWarenannahme.toString().includes(searchTerm) ||
        (item.KundenFirma && item.KundenFirma.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.cTransporteur && item.cTransporteur.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status-Filter
    if (statusFilter !== 'alle') {
      filtered = filtered.filter(item => item.cStatus === statusFilter);
    }

    setFilteredData(filtered);
  }, [data.list, searchTerm, statusFilter]);

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
      
      {/* Ergebnisinfo */}
      {searchTerm || statusFilter !== 'alle' ? (
        <div style={{
          marginBottom: '16px',
          padding: '8px 16px',
          background: '#f0f0f0',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#666'
        }}>
          {filteredData.length} von {data.list?.length || 0} Einträgen gefunden
        </div>
      ) : null}
      
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
                <th>Foto</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
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
                  <td>
                    {item.cFotoPath ? (
                      <button 
                        className="photo-button"
                        onClick={() => onPhotoClick(item.cFotoPath)}
                        title="Foto anzeigen"
                      >
                        <Image size={16} />
                      </button>
                    ) : (
                      <span className="no-photo">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="action-button"
                        onClick={() => onDetailsClick(item.kWarenannahme)}
                        title="Details anzeigen"
                      >
                        👁️
                      </button>
                      <button 
                        className="action-button"
                        onClick={() => onLabelPrint(item)}
                        title="Etikett drucken"
                      >
                        🖨️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {searchTerm || statusFilter !== 'alle' ? (
            <>
              <p style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
                Keine Warenannahmen gefunden
              </p>
              <p style={{ fontSize: '14px', color: '#999' }}>
                Versuchen Sie es mit anderen Suchbegriffen oder Filtern
              </p>
            </>
          ) : (
            <p>Keine Warenannahmen vorhanden</p>
          )}
        </div>
      )}
    </div>
  );
};

// PLATZHALTER-KOMPONENTEN
const InventoryView = () => (
  <div>
    <h2>Lagerbestand</h2>
    <p>Hier wird der aktuelle Lagerbestand angezeigt...</p>
  </div>
);

const CustomersView = () => (
  <div>
    <h2>Kunden Übersicht</h2>
    <p>Hier werden alle Kunden und deren Status angezeigt...</p>
  </div>
);

export default Dashboard;