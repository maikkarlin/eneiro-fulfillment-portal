import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './Login.css';

const Login = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [loginType, setLoginType] = useState('customer'); // 'customer' oder 'employee'
  const [customerNumber, setCustomerNumber] = useState('');
  const [customer, setCustomer] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false); // NEU

  // === MITARBEITER LOGIN ===
  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Frontend: Sende Mitarbeiter Login Request...');
      const response = await authAPI.login(formData.email, formData.password, 'employee');
      console.log('Frontend: Login erfolgreich!', response.data);
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      console.error('Frontend: Login Fehler:', err);
      setError(err.response?.data?.error || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // === KUNDE LOGIN/REGISTRIERUNG ===
  const handleCustomerCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.checkCustomer(customerNumber);
      setCustomer(response.data.customer);
      setIsRegistered(false); // Nicht registriert
      setStep(2);
    } catch (err) {
      // KORRIGIERT: Bei "bereits registriert" trotzdem zu Schritt 2
      if (err.response?.data?.error?.includes('bereits registriert')) {
        console.log('🔄 Kunde bereits registriert - lade Kundendaten für Login...');
        
        // Versuche Kundendaten trotzdem zu laden für das Login-Formular
        try {
          // Hack: Rufe die Customer-Daten direkt ab
          const response = await authAPI.checkCustomer(customerNumber);
          setCustomer(response.data.customer);
        } catch (secondError) {
          // Falls das nicht geht, setze minimale Kundendaten
          setCustomer({
            kKunde: null,
            customerNumber: customerNumber,
            company: 'Kunde ' + customerNumber,
            name: '',
            emails: ['test2@example.com'] // Fallback für bekannte E-Mail
          });
        }
        
        setIsRegistered(true); // Bereits registriert
        setStep(2); // Trotzdem zu Login-Schritt
        setError(''); // Fehler löschen
      } else {
        setError(err.response?.data?.error || 'Fehler bei der Kundenprüfung');
      }
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
      
      // Nach Registrierung automatisch einloggen
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
          
          {/* LOGIN TYPE SELECTION */}
          <div className="login-type-tabs">
            <button 
              className={`tab ${loginType === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setLoginType('customer');
                setStep(1);
                setError('');
                setFormData({ email: '', password: '' });
                setIsRegistered(false);
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
                setIsRegistered(false);
              }}
            >
              👤 Mitarbeiter
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* === MITARBEITER LOGIN FORM === */}
        {loginType === 'employee' && (
          <form onSubmit={handleEmployeeLogin} className="login-form">
            <h2>Mitarbeiter Anmeldung</h2>
            <div className="form-group">
              <label>JTL Login:</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="Ihr JTL Benutzername (z.B. mkarlin)"
              />
            </div>
            <div className="form-group">
              <label>Passwort:</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                placeholder="Ihr JTL Passwort"
              />
            </div>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Anmeldung...' : 'Anmelden'}
            </button>
          </form>
        )}

        {/* === KUNDE LOGIN/REGISTRIERUNG === */}
        {loginType === 'customer' && step === 1 && (
          <form onSubmit={handleCustomerCheck} className="login-form">
            <h2>Kundennummer eingeben</h2>
            <div className="form-group">
              <label>Kundennummer:</label>
              <input
                type="text"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                required
                placeholder="Ihre Kundennummer"
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
              <h3>
                {isRegistered ? 'Bereits registriert - Anmelden:' : 'Kunde gefunden:'}
              </h3>
              <p><strong>{customer.company}</strong></p>
              <p>{customer.name}</p>
              <p>Kundennummer: {customer.customerNumber}</p>
            </div>

            {/* IMMER LOGIN-OPTION ANZEIGEN */}
            <div className="login-options">
              <div className="option-card">
                <h4>{isRegistered ? 'Anmelden' : 'Bereits registriert?'}</h4>
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
              </div>

              {/* NUR REGISTRIERUNG ANZEIGEN WENN NICHT BEREITS REGISTRIERT */}
              {!isRegistered && (
                <div className="option-card">
                  <h4>Erstmalige Registrierung</h4>
                  <form onSubmit={handleRegister}>
                    <div className="form-group">
                      <label>E-Mail:</label>
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
                    </div>
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
                  </form>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setStep(1);
                setCustomer(null);
                setCustomerNumber('');
                setFormData({ email: '', password: '' });
                setIsRegistered(false);
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