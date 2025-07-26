import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { Package, Loader } from 'lucide-react';
import './Login.css';

function Login({ onLogin }) {
  const [step, setStep] = useState('check'); // check, register, login
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  const handleCheckCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.checkCustomer(customerNumber);
      setCustomerData(response.data.customer);
      setEmail(response.data.customer.emails[0] || '');
      setStep('register');
    } catch (err) {
      if (err.response?.data?.error?.includes('bereits registriert')) {
        setIsRegistered(true);
        setStep('login');
      } else if (err.response?.status === 404) {
        setError('Kundennummer nicht gefunden');
      } else {
        setError('Ein Fehler ist aufgetreten');
      }
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
        kKunde: customerData.kKunde,
        email,
        password
      });
      setStep('login');
      setIsRegistered(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(email, password);
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError('Ungültige Anmeldedaten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img 
            src="https://eneiro.de/wp-content/uploads/2020/08/eneiro-negativ-logo.png" 
            alt="Eneiro" 
            className="logo"
          />
          <h1>Fulfillment Portal</h1>
        </div>

        {step === 'check' && (
          <form onSubmit={handleCheckCustomer}>
            <h2>Willkommen!</h2>
            <p>Geben Sie Ihre Kundennummer ein, um zu beginnen.</p>
            
            <div className="form-group">
              <label>Kundennummer</label>
              <input
                type="text"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                placeholder="z.B. 486822"
                required
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? <Loader className="spinner" /> : 'Weiter'}
            </button>
          </form>
        )}

        {step === 'register' && customerData && (
          <form onSubmit={handleRegister}>
            <h2>Account erstellen</h2>
            <p>Willkommen, {customerData.company || customerData.name}!</p>
            
            <div className="form-group">
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                required
                minLength="8"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? <Loader className="spinner" /> : 'Account erstellen'}
            </button>

            <button type="button" onClick={() => setStep('check')} className="link-button">
              Zurück
            </button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin}>
            <h2>{isRegistered ? 'Fast fertig!' : 'Anmelden'}</h2>
            {isRegistered && <p className="success-message">Account erfolgreich erstellt!</p>}
            
            <div className="form-group">
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? <Loader className="spinner" /> : 'Anmelden'}
            </button>

            <button type="button" onClick={() => setStep('check')} className="link-button">
              Andere Kundennummer verwenden
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;