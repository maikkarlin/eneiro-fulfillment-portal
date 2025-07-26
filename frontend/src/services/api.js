import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Axios Instanz mit Base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token automatisch hinzufügen
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

// API Funktionen
export const authAPI = {
  checkCustomer: (customerNumber) => 
    api.post('/auth/check-customer', { customerNumber }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
};

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

export default api;