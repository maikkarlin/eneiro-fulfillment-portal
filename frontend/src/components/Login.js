// frontend/src/components/Login.js - MIT TABS
import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './Login.css';

const Login = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [loginType, setLoginType] = useState('customer');
  const [customerNumber, setCustomerNumber] = useState('');
  const [customer, setCustomer] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // 'login' oder 'register'

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData.email, formData.password, 'employee');
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.getCustomerData(customerNumber);
      
      setCustomer(response.data.customer);
      setIsRegistered(response.data.isRegistered);
      setActiveTab(response.data.isRegistered ? 'login' : 'register');
      setStep(2);
      setError('');
      
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler bei der Kundenprüfung');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData.email, formData.password, 'customer');
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.register({
        kKunde: customer.kKunde,
        email: formData.email,
        password: formData.password
      });
      
      const response = await authAPI.login(formData.email, formData.password, 'customer');
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Eneiro Fulfillment Portal</h1>
          
          <div className="login-type-tabs">
            <button 
              className={`tab ${loginType === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setLoginType('customer');
                setStep(1);
                setError('');
                setFormData({ email: '', password: '' });
                setIsRegistered(false);
                setCustomer(null);
                setCustomerNumber('');
              }}
            >
              🏢 Kunde
            </button>
            <button 
              className={`tab ${loginType === 'employee' ? 'active' : ''}`}
              onClick={() => {
                setLoginType('employee');
                setStep(1);
                setError('');
                setFormData({ email: '', password: '' });
              }}
            >
              👤 Mitarbeiter
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loginType === 'employee' && (
          <form onSubmit={handleEmployeeLogin}>
            <div className="form-group">
              <label>Login / E-Mail:</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="z.B. maikkarlin oder maik@eneiro.de"
              />
            </div>
            <div className="form-group">
              <label>Passwort:</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Anmeldung...' : 'Anmelden'}
            </button>
          </form>
        )}

        {loginType === 'customer' && step === 1 && (
          <form onSubmit={handleCustomerCheck}>
            <div className="form-group">
              <label>Kundennummer:</label>
              <input
                type="text"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                required
                placeholder="z.B. FFN190"
              />
            </div>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Prüfung...' : 'Weiter'}
            </button>
          </form>
        )}

        {loginType === 'customer' && step === 2 && customer && (
          <div>
            <div className="customer-info">
              <h3>Kunde gefunden:</h3>
              <p><strong>{customer.company}</strong></p>
              <p>{customer.name}</p>
              <p>Kundennummer: {customer.customerNumber}</p>
            </div>

            {/* TAB-NAVIGATION */}
            <div className="auth-tabs">
              <button
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                }}
              >
                Anmelden
              </button>
              {!isRegistered && (
                <button
                  className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('register');
                    setError('');
                  }}
                >
                  Registrieren
                </button>
              )}
            </div>

            {/* TAB CONTENT */}
            <div className="auth-tab-content">
              {activeTab === 'login' && (
                <form onSubmit={handleCustomerLogin}>
                  <div className="form-group">
                    <label>E-Mail:</label>
                    {customer.emails && customer.emails.length > 0 ? (
                      <select
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      >
                        <option value="">E-Mail auswählen</option>
                        {customer.emails.map((email, index) => (
                          <option key={index} value={email}>{email}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="E-Mail eingeben"
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Passwort:</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="submit-button">
                    {loading ? 'Anmeldung...' : 'Anmelden'}
                  </button>
                </form>
              )}

              {activeTab === 'register' && !isRegistered && (
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label>E-Mail:</label>
                    {customer.emails && customer.emails.length > 0 ? (
                      <select
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      >
                        <option value="">E-Mail auswählen</option>
                        {customer.emails.map((email, index) => (
                          <option key={index} value={email}>{email}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="no-emails-warning">
                        <p>⚠️ Keine E-Mail-Adressen hinterlegt</p>
                        <p style={{fontSize: '13px', color: '#666', marginTop: '8px'}}>
                          Bitte kontaktieren Sie den Support
                        </p>
                      </div>
                    )}
                  </div>
                  {customer.emails && customer.emails.length > 0 && (
                    <>
                      <div className="form-group">
                        <label>Neues Passwort:</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          required
                          minLength="8"
                          placeholder="Mindestens 8 Zeichen"
                        />
                      </div>
                      <button type="submit" disabled={loading} className="submit-button register">
                        {loading ? 'Registrierung...' : 'Registrieren'}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>

            <button 
              onClick={() => {
                setStep(1);
                setCustomer(null);
                setCustomerNumber('');
                setFormData({ email: '', password: '' });
                setIsRegistered(false);
                setActiveTab('login');
                setError('');
              }}
              className="back-button"
            >
              ← Zurück
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;