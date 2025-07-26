import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { 
  BarChart3, Package, TrendingUp, Users, 
  FileText, Download, LogOut, Menu, X,
  DollarSign, ShoppingCart, Truck, Calendar,
  Clock, AlertCircle, CheckCircle, Loader
} from 'lucide-react';
import './Dashboard.css';
import ItemizedRecords from './ItemizedRecords';

function Dashboard({ user, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getKPIs();
      setKpis(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der KPIs:', error);
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

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="menu-button mobile-only"
            >
              {sidebarOpen ? <X /> : <Menu />}
            </button>
            <img 
              src="https://eneiro.de/wp-content/uploads/2020/08/eneiro-negativ-logo.png" 
              alt="Eneiro" 
              className="logo"
            />
            <div className="divider" />
            <h1>Fulfillment Portal</h1>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-number">{user?.customerNumber}</span>
            </div>
            <button onClick={onLogout} className="logout-button">
              <LogOut />
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav>
            <button
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <BarChart3 />
              Dashboard
            </button>
            
            <button
              onClick={() => { setActiveTab('invoices'); setSidebarOpen(false); }}
              className={`nav-item ${activeTab === 'invoices' ? 'active' : ''}`}
            >
              <FileText />
              Abrechnungen
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {loading ? (
            <div className="loading-container">
              <Loader className="loading-spinner" />
              <p>Daten werden geladen...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && kpis && (
                <div className="dashboard-content">
                  <h2>Dashboard Übersicht</h2>
                  
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Bestellungen Gesamt</p>
                          <p className="kpi-value">{kpis.totalOrders.toLocaleString()}</p>
                          <p className="kpi-trend positive">
                            <TrendingUp />
                            {kpis.ordersTrend > 0 ? '+' : ''}{kpis.ordersTrend}% vs. Vormonat
                          </p>
                        </div>
                        <div className="kpi-icon blue">
                          <ShoppingCart />
                        </div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Umsatz diesen Monat</p>
                          <p className="kpi-value">{formatCurrency(kpis.revenue)}</p>
                          <p className="kpi-trend positive">
                            <TrendingUp />
                            Aktueller Monat
                          </p>
                        </div>
                        <div className="kpi-icon purple">
                          <DollarSign />
                        </div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Offene Sendungen</p>
                          <p className="kpi-value">{kpis.pendingShipments}</p>
                          <p className="kpi-trend neutral">
                            <Clock />
                            Ø {kpis.averageProcessingTime}h Bearbeitungszeit
                          </p>
                        </div>
                        <div className="kpi-icon green">
                          <Truck />
                        </div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Bestellungen Heute</p>
                          <p className="kpi-value">{kpis.ordersToday}</p>
                          <p className="kpi-trend neutral">
                            <Calendar />
                            {new Date().toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="kpi-icon orange">
                          <Package />
                        </div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Retourenquote</p>
                          <p className="kpi-value">{kpis.returnRate}%</p>
                          <p className="kpi-trend positive">
                            <CheckCircle />
                            Unter Zielwert (3%)
                          </p>
                        </div>
                        <div className="kpi-icon red">
                          <AlertCircle />
                        </div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-header">
                        <div className="kpi-info">
                          <p className="kpi-label">Versendete Pakete</p>
                          <p className="kpi-value">{kpis.packagesShipped}</p>
                          <p className="kpi-trend neutral">
                            <Package />
                            Diesen Monat
                          </p>
                        </div>
                        <div className="kpi-icon indigo">
                          <Truck />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'invoices' && (
                <div className="dashboard-content">
                  <ItemizedRecords />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;