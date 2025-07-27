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
  
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
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

export default api;