import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  LogOut, 
  Menu, 
  FileText,
  DollarSign,
  Truck,
  PercentIcon,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import ItemizedRecords from './ItemizedRecords';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({});
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getKPIs();
      setKpis(response.data);
      setError(null);
    } catch (err) {
      console.error('Fehler beim Laden der KPIs:', err);
      setError('Fehler beim Laden der Dashboard-Daten');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('de-DE').format(value);
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp size={16} />;
    if (trend < 0) return <TrendingDown size={16} />;
    return <Minus size={16} />;
  };

  const getTrendClass = (trend) => {
    if (trend > 0) return 'positive';
    if (trend < 0) return 'negative';
    return 'neutral';
  };

  const getKPICards = () => [
    {
      label: 'Bestellungen (Monat)',
      value: formatNumber(kpis.totalOrders || 0),
      trend: kpis.ordersTrend || 0,
      icon: Package,
      color: '#2a5298',
      bgColor: '#e8f0ff'
    },
    {
      label: 'Bestellungen heute',
      value: formatNumber(kpis.ordersToday || 0),
      icon: TrendingUp,
      color: '#059669',
      bgColor: '#d1fae5'
    },
    {
      label: 'Offene Sendungen',
      value: formatNumber(kpis.pendingShipments || 0),
      icon: Clock,
      color: '#dc2626',
      bgColor: '#fee2e2'
    },
    {
      label: 'Umsatz (Monat)',
      value: formatCurrency(kpis.revenue || 0),
      icon: DollarSign,
      color: '#7c3aed',
      bgColor: '#ede9fe'
    },
    {
      label: 'Versendete Pakete',
      value: formatNumber(kpis.packagesShipped || 0),
      icon: Truck,
      color: '#ea580c',
      bgColor: '#fed7aa'
    },
    {
      label: 'Ø Bearbeitungszeit',
      value: `${kpis.averageProcessingTime || 0} Tage`,
      icon: Clock,
      color: '#0891b2',
      bgColor: '#cffafe'
    },
    {
      label: 'Retourenquote',
      value: `${kpis.returnRate || 0}%`,
      icon: PercentIcon,
      color: '#c2410c',
      bgColor: '#ffedd5'
    }
  ];

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <BarChart3 className="loading-spinner" />
          <p>Lade Dashboard-Daten...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={loadKPIs} className="retry-button">
            Erneut versuchen
          </button>
        </div>
      );
    }

    const kpiCards = getKPICards();

    return (
      <div className="overview-content">
        <div className="kpi-grid">
          {kpiCards.map((kpi, index) => (
            <div key={index} className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-info">
                  <p className="kpi-label">{kpi.label}</p>
                  <h3 className="kpi-value">{kpi.value}</h3>
                  {kpi.trend !== undefined && (
                    <p className={`kpi-trend ${getTrendClass(kpi.trend)}`}>
                      {getTrendIcon(kpi.trend)}
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

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return renderOverview();
      case 'itemized':
        return <ItemizedRecords />;
      case 'orders':
        return (
          <div className="content-placeholder">
            <h2>Bestellungen</h2>
            <p>Bestellübersicht wird hier angezeigt...</p>
          </div>
        );
      case 'reports':
        return (
          <div className="content-placeholder">
            <h2>Berichte</h2>
            <p>Berichte werden hier angezeigt...</p>
          </div>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              className="menu-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
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
  {user && (
    <div className="user-info">
      <span className="user-name">
        {user.company || user.name || 'Benutzer'}
      </span>
      <span className="user-number">Kunde: {user.customerNumber}</span>
    </div>
  )}
            <button onClick={onLogout} className="logout-button">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <nav>
            <button
              className={`nav-item ${activeView === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveView('overview')}
            >
              <BarChart3 />
              Übersicht
            </button>
            <button
              className={`nav-item ${activeView === 'itemized' ? 'active' : ''}`}
              onClick={() => setActiveView('itemized')}
            >
              <FileText />
              Einzelverbindungsnachweis
            </button>
            <button
              className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveView('orders')}
            >
              <Package />
              Bestellungen
            </button>
            <button
              className={`nav-item ${activeView === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveView('reports')}
            >
              <TrendingUp />
              Berichte
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          <div className="dashboard-content">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;