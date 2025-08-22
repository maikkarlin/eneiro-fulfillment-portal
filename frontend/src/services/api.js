// frontend/src/services/api.js - VOLLSTÄNDIGE VERSION mit allen Fixes
import axios from 'axios';

// API Base URL - WICHTIG: Muss auf Ihren Server zeigen!
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://portal.infra-gw.io/api'  // Production URL über Ihren Reverse Proxy
    : 'http://localhost:5000/api'); // Development URL

console.log('🌐 API Base URL:', API_BASE_URL);

// Axios Instanz erstellen
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000
});

// Request Interceptor für Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('📤 Request Error:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor für Error Handling
api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('📥 API Error:', error.message, error.config?.url);
    
    if (error.response?.status === 401) {
      // Token abgelaufen
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API - ERWEITERT mit neuer getCustomerData Funktion
export const authAPI = {
  // NEU: Kundendaten abrufen (immer, egal ob registriert)
  getCustomerData: (customerNumber) => 
    api.post('/auth/get-customer-data', { customerNumber }),
  
  // BESTEHENDE Funktionen
  checkCustomer: (customerNumber) => 
    api.post('/auth/check-customer', { customerNumber }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  login: (email, password, loginType = 'customer') => 
    api.post('/auth/login', { email, password, loginType }),
    
  getEmployees: () =>
    api.get('/auth/employees'),
};

// Dashboard API - UNVERÄNDERT
export const dashboardAPI = {
  getKPIs: () => 
    api.get('/dashboard/kpis'),
  
  getOrdersHistory: () => 
    api.get('/dashboard/orders-history'),
    
  getItemizedRecords: (month) => 
    api.get(`/dashboard/itemized-records/${month || ''}`),
    
  getAvailableMonths: () => 
    api.get('/dashboard/available-months'),
};

// Warenannahme API - VOLLSTÄNDIG mit allen benötigten Funktionen
export const goodsReceiptAPI = {
  // ✅ Alle Warenannahmen (für Mitarbeiter)
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/goods-receipt?${params}`);
  },
  
  // ✅ Warenannahmen für angemeldeten Kunden
  getCustomerReceipts: () => 
    api.get('/goods-receipt/customer'),
  
  // ✅ Einzelne Warenannahme (für Mitarbeiter)
  getById: (id) => 
    api.get(`/goods-receipt/${id}`),
  
  // ✅ Einzelne Warenannahme für Kunden
  getCustomerReceiptById: (id) => 
    api.get(`/goods-receipt/customer/${id}`),
  
  // ✅ Neue Warenannahme erstellen
  create: (formData) => {
    return api.post('/goods-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // ✅ Warenannahme aktualisieren
  update: (id, formData) => {
    return api.put(`/goods-receipt/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // ✅ Status aktualisieren (nur für Mitarbeiter)
  updateStatus: (id, status) => 
    api.patch(`/goods-receipt/${id}/status`, { cStatus: status }),
  
  // ✅ Warenannahme löschen
  delete: (id) => 
    api.delete(`/goods-receipt/${id}`),
  
  // ✅ Statistiken für Dashboard - KORRIGIERT
  getStats: () => 
    api.get('/goods-receipt/stats'),
};

// Customers API - UNVERÄNDERT
export const customersAPI = {
  getAll: () => 
    api.get('/customers'),
};

// Blocklager API - UNVERÄNDERT
export const blocklagerAPI = {
  searchArticle: (query) => 
    api.get(`/blocklager/artikel/search?q=${encodeURIComponent(query)}`),
  
  saveFields: (articleNumber, fields) =>
    api.post(`/blocklager/artikel/${articleNumber}/fields`, fields),
  
  getStockMovements: (articleNumber) =>
    api.get(`/blocklager/artikel/${articleNumber}/movements`),
};

// NEU: Documents API für Lieferscheine hinzufügen

export const documentsAPI = {
  // Lieferschein hochladen (nur Mitarbeiter)
  uploadDeliveryNote: (warenannahmeId, formData) => {
    return api.post(`/documents/upload/${warenannahmeId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Alle Dokumente einer Warenannahme abrufen
  getDocuments: (warenannahmeId) => 
    api.get(`/documents/warenannahme/${warenannahmeId}`),
  
  // Dokument herunterladen/anzeigen
  downloadDocument: (dokumentId) => 
    api.get(`/documents/download/${dokumentId}`, {
      responseType: 'blob', // Wichtig für PDF-Download
    }),
  
  // Dokument löschen (nur Mitarbeiter)
  deleteDocument: (dokumentId) => 
    api.delete(`/documents/${dokumentId}`),
  
  // Helper: PDF in neuem Tab öffnen
  openPdfInNewTab: async (dokumentId) => {
    try {
      const response = await api.get(`/documents/download/${dokumentId}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // URL nach kurzer Zeit freigeben
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Fehler beim Öffnen der PDF:', error);
      throw error;
    }
  }
};

export default api;