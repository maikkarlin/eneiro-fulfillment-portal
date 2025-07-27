const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Employee = require('../models/Employee'); // NEU
const Customer = require('../models/Customer');
const { generateToken } = require('../utils/jwt');

// Test-Route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth-Routes funktionieren!' });
});

// === KUNDE LOGIN SYSTEM (bestehend) ===
// Registrierung - Schritt 1: Kundennummer prüfen
router.post('/check-customer', async (req, res) => {
  try {
    const { customerNumber } = req.body;
    
    if (!customerNumber) {
      return res.status(400).json({ 
        error: 'Kundennummer ist erforderlich' 
      });
    }
    
    // Kunde in JTL suchen
    const customer = await Customer.findByCustomerNumber(customerNumber);
    
    if (!customer) {
      return res.status(404).json({ 
        error: 'Kundennummer nicht gefunden' 
      });
    }
    
    // Prüfe ob bereits registriert
    const isRegistered = await User.isCustomerRegistered(customer.kKunde);
    
    if (isRegistered) {
      return res.status(400).json({ 
        error: 'Kunde ist bereits registriert. Bitte melden Sie sich an.' 
      });
    }
    
    // Hole alle E-Mail-Adressen des Kunden
    const emails = await Customer.getCustomerEmails(customer.kKunde);
    
    res.json({
      message: 'Kunde gefunden',
      customer: {
        kKunde: customer.kKunde,
        customerNumber: customer.cKundenNr,
        company: customer.cFirma,
        name: `${customer.cVorname || ''} ${customer.cName || ''}`.trim(),
        emails: emails
      }
    });
    
  } catch (error) {
    console.error('Check customer error:', error);
    res.status(500).json({ error: 'Serverfehler: ' + error.message });
  }
});

// Registrierung - Schritt 2: Account erstellen
router.post('/register', async (req, res) => {
  try {
    const { kKunde, email, password } = req.body;
    
    // Validierung
    if (!email || !password || !kKunde) {
      return res.status(400).json({ 
        error: 'Alle Felder sind erforderlich' 
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Passwort muss mindestens 8 Zeichen lang sein' 
      });
    }
    
    // User erstellen
    const userId = await User.create(kKunde, email, password);
    
    res.json({
      message: 'Registrierung erfolgreich! Sie können sich jetzt anmelden.',
      userId
    });
    
  } catch (error) {
    if (error.message.includes('UNIQUE KEY')) {
      return res.status(400).json({ 
        error: 'Diese E-Mail-Adresse wird bereits verwendet' 
      });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Serverfehler bei der Registrierung' });
  }
});

// === UNIVERSAL LOGIN (Kunde ODER Mitarbeiter) ===
router.post('/login', async (req, res) => {
  try {
    const { email, password, loginType } = req.body;
    
    console.log('Login-Versuch:', { email, loginType });
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'E-Mail/Login und Passwort sind erforderlich' 
      });
    }

    // === MITARBEITER LOGIN ===
    if (loginType === 'employee') {
      console.log('🔍 Mitarbeiter Login für:', email);
      
      // Login über JTL tBenutzer
      const employee = await Employee.findByLogin(email);
      
      if (!employee) {
        console.log('❌ Mitarbeiter nicht gefunden:', email);
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten - Mitarbeiter nicht gefunden' 
        });
      }

      console.log('✅ Mitarbeiter gefunden:', employee.cLogin);

      // JTL Passwort prüfen
      const validPassword = Employee.verifyJTLPassword(password, employee.cPasswort, employee.iSalt);
      
      if (!validPassword) {
        console.log('❌ JTL Passwort-Prüfung fehlgeschlagen für:', employee.cLogin);
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten - Falsches Passwort' 
        });
      }
      
      console.log('✅ Passwort korrekt für:', employee.cLogin);
      
      // Login-Zeit aktualisieren
      await Employee.updateLastLogin(employee.kBenutzer);
      
      // JWT Token für Mitarbeiter erstellen
      const token = generateToken({
        id: employee.kBenutzer,
        email: employee.cEMail,
        login: employee.cLogin,
        role: 'employee',
        name: employee.cName,
        department: employee.cAbteilung
      });
      
      res.json({
        token,
        user: {
          id: employee.kBenutzer,
          login: employee.cLogin,
          name: employee.cName,
          email: employee.cEMail,
          department: employee.cAbteilung,
          role: 'employee'
        }
      });
      
    } else {
      // === KUNDE LOGIN (bestehend) ===
      console.log('🔍 Kunde Login für:', email);
      
      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten - User nicht gefunden' 
        });
      }
      
      // Passwort prüfen
      const validPassword = await bcrypt.compare(password, user.cPasswordHash);
      
      if (!validPassword) {
        return res.status(401).json({ 
          error: 'Ungültige Anmeldedaten - Falsches Passwort' 
        });
      }
      
      // Login-Zeit aktualisieren
      await User.updateLastLogin(user.kPortalUser);
      
      // JWT Token für Kunde erstellen
      const token = generateToken({
        id: user.kPortalUser,
        kKunde: user.kKunde,
        email: user.cEmail,
        customerNumber: user.cKundenNr,
        role: 'customer'
      });
      
      res.json({
        token,
        user: {
          id: user.kPortalUser,
          customerNumber: user.cKundenNr,
          company: user.cFirma,
          name: `${user.cVorname || ''} ${user.cName || ''}`.trim(),
          email: user.cEmail,
          role: 'customer'
        }
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Serverfehler beim Login: ' + error.message });
  }
});

// === MITARBEITER-SPEZIFISCHE ROUTES ===
// Alle aktiven Mitarbeiter abrufen (für Dropdowns etc.)
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.getAllActive();
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Mitarbeiter' });
  }
});

module.exports = router;