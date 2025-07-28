import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor für Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token abgelaufen
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  checkCustomer: (customerNumber) => 
    api.post('/auth/check-customer', { customerNumber }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  login: (email, password, loginType = 'customer') => 
    api.post('/auth/login', { email, password, loginType }),
    
  getEmployees: () =>
    api.get('/auth/employees'),
};

// Dashboard API
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

// Warenannahme API - NEU
export const goodsReceiptAPI = {
  // Alle Warenannahmen abrufen
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/goods-receipt?${params}`);
  },
  
  // Einzelne Warenannahme abrufen
  getById: (id) => 
    api.get(`/goods-receipt/${id}`),
  
  // Neue Warenannahme erstellen
  create: (data) => {
    const formData = new FormData();
    
    // Alle Felder hinzufügen
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    
    return api.post('/goods-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Status aktualisieren
  updateStatus: (id, status) => 
    api.patch(`/goods-receipt/${id}/status`, { cStatus: status }),
  
  // Komplett aktualisieren
  update: (id, data) => {
    const formData = new FormData();
    
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    
    return api.put(`/goods-receipt/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Löschen
  delete: (id) => 
    api.delete(`/goods-receipt/${id}`),
  
  // Dashboard-Statistiken
  getStats: () => 
    api.get('/goods-receipt/stats/dashboard'),

    // NEUE FUNKTIONEN FÜR KUNDEN:
  
  // Alle Warenannahmen für angemeldeten Kunden abrufen
  getCustomerReceipts: () => 
    api.get('/goods-receipt/customer'),
  
  // Einzelne Warenannahme für Kunden abrufen
  getCustomerReceiptById: (id) => 
    api.get(`/goods-receipt/customer/${id}`),

};

// Kunden API - NEU
export const customersAPI = {
  getAll: () => 
    api.get('/customers'),
};


export default api;