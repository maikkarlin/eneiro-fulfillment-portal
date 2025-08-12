// frontend/src/services/api.js - KORRIGIERTE VERSION
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

// Warenannahme API
export const goodsReceiptAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/goods-receipt?${params}`);
  },
  
  getById: (id) => 
    api.get(`/goods-receipt/${id}`),
  
  create: (formData) => {
    return api.post('/goods-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  update: (id, formData) => {
    return api.put(`/goods-receipt/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  delete: (id) => 
    api.delete(`/goods-receipt/${id}`),
};

// Customers API
export const customersAPI = {
  getAll: () => 
    api.get('/customers'),
};

// Blocklager API
export const blocklagerAPI = {
  searchArticle: (query) => 
    api.get(`/blocklager/artikel/search?q=${encodeURIComponent(query)}`),
  
  saveFields: (articleNumber, fields) =>
    api.post(`/blocklager/artikel/${articleNumber}/fields`, fields),
  
  getStockMovements: (articleNumber) =>
    api.get(`/blocklager/artikel/${articleNumber}/movements`),
};

export default api;