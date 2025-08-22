#!/bin/bash

# =======================================================
# 🚀 FULFILLMENT PORTAL - SECURE DEPLOYMENT SCRIPT
# =======================================================
# Ubuntu 24.04 LTS - Sichere Installation mit eigenem User
# Author: Claude & User Collaboration
# Version: 2.1 (August 2025) - PM2 FIX
# =======================================================

set -e  # Exit on error

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguration
APP_NAME="eneiro-fulfillment-portal"
APP_USER="fulfillment"
APP_HOME="/home/$APP_USER"
APP_DIR="$APP_HOME/$APP_NAME"
GITHUB_REPO="https://github.com/maikkarlin/$APP_NAME.git"  # ANPASSEN!
NODE_VERSION="20"  # LTS Version

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}🚀 FULFILLMENT PORTAL DEPLOYMENT - START${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Dieses Script muss als root ausgeführt werden (sudo)${NC}"
   exit 1
fi

echo -e "${YELLOW}📋 Installiere System Dependencies...${NC}"

# System Update
apt update && apt upgrade -y

# Basis-Pakete installieren (OHNE pm2!)
apt install -y git curl wget unzip nginx-light ufw build-essential

# Node.js installieren (falls nicht vorhanden)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installiere Node.js $NODE_VERSION...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js $(node --version) installiert${NC}"
else
    echo -e "${BLUE}ℹ️  Node.js bereits installiert: $(node --version)${NC}"
fi

# PM2 über npm installieren (NACH Node.js!)
echo -e "${YELLOW}📦 Installiere PM2 über npm...${NC}"
npm install -g pm2
echo -e "${GREEN}✅ PM2 $(pm2 --version) installiert${NC}"

echo -e "${GREEN}✅ System Dependencies installiert${NC}"

# =======================================================
# 👤 SICHERER APP-USER ERSTELLEN
# =======================================================

echo -e "${YELLOW}👤 Erstelle sicheren App-User '$APP_USER'...${NC}"

# User erstellen (falls nicht vorhanden)
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash -G www-data "$APP_USER"
    echo -e "${GREEN}✅ User '$APP_USER' erstellt${NC}"
else
    echo -e "${BLUE}ℹ️  User '$APP_USER' existiert bereits${NC}"
fi

echo -e "${GREEN}✅ App-User konfiguriert${NC}"

# =======================================================
# 📁 VERZEICHNISSE & BERECHTIGUNGEN
# =======================================================

echo -e "${YELLOW}📁 Erstelle Verzeichnisse...${NC}"

# App-Verzeichnis erstellen
sudo -u "$APP_USER" mkdir -p "$APP_DIR"

# Uploads-Verzeichnis mit korrekten Berechtigungen
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/uploads/warenannahme"

# Logs-Verzeichnis
sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"

echo -e "${GREEN}✅ Verzeichnisse erstellt${NC}"

# =======================================================
# 📥 CODE VON GITHUB HOLEN
# =======================================================

echo -e "${YELLOW}📥 Lade Code von GitHub...${NC}"

# Prüfen ob Verzeichnis existiert und Code vorhanden ist
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${BLUE}ℹ️  Repository existiert bereits - updating...${NC}"
    cd "$APP_DIR"
    sudo -u "$APP_USER" git fetch --all
    sudo -u "$APP_USER" git reset --hard origin/main
    sudo -u "$APP_USER" git pull origin main
else
    echo -e "${BLUE}ℹ️  Klone Repository...${NC}"
    sudo -u "$APP_USER" git clone "$GITHUB_REPO" "$APP_DIR"
fi

cd "$APP_DIR"

echo -e "${GREEN}✅ Code von GitHub geladen${NC}"

# =======================================================
# 🔧 BACKEND SETUP
# =======================================================

echo -e "${YELLOW}🔧 Setup Backend...${NC}"

cd "$APP_DIR/backend"

# Dependencies installieren
echo -e "${BLUE}📦 Installiere Backend Dependencies...${NC}"
sudo -u "$APP_USER" npm install --production

# Environment erstellen (falls nicht vorhanden)
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Erstelle .env Datei...${NC}"
    sudo -u "$APP_USER" cat > .env << 'EOL'
# Datenbank Konfiguration (ANPASSEN!)
DB_SERVER=DEIN_WINDOWS_SERVER_IP
DB_DATABASE=DEINE_DATENBANK
DB_USER=DEIN_DB_USER
DB_PASSWORD=DEIN_DB_PASSWORD
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT Secret (Sicher generieren!)
JWT_SECRET=dein_super_sicherer_jwt_secret_hier_mindestens_32_zeichen

# Server Konfiguration
PORT=3001
NODE_ENV=production

# Upload Konfiguration
UPLOAD_MAX_SIZE=50MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf
EOL
    
    echo -e "${RED}⚠️  WICHTIG: Bearbeite $APP_DIR/backend/.env mit deinen Datenbank-Zugangsdaten!${NC}"
    echo -e "${RED}⚠️  JWT_SECRET sollte ein sicherer, zufälliger String sein!${NC}"
fi

echo -e "${GREEN}✅ Backend setup abgeschlossen${NC}"

# =======================================================
# 🎨 FRONTEND BUILD
# =======================================================

echo -e "${YELLOW}🎨 Build Frontend...${NC}"

cd "$APP_DIR/frontend"

# Dependencies installieren
echo -e "${BLUE}📦 Installiere Frontend Dependencies...${NC}"
sudo -u "$APP_USER" npm install

# Production Build
echo -e "${BLUE}🏗️  Erstelle Production Build...${NC}"
sudo -u "$APP_USER" npm run build

echo -e "${GREEN}✅ Frontend Build abgeschlossen${NC}"

# =======================================================
# 🚀 PM2 KONFIGURATION
# =======================================================

echo -e "${YELLOW}🚀 Konfiguriere PM2...${NC}"

cd "$APP_DIR"

# PM2 Ecosystem Datei erstellen
sudo -u "$APP_USER" cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'fulfillment-backend',
    script: './backend/server.js',
    cwd: '/home/fulfillment/fulfillment-portal',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/backend-error.log',
    out_file: './logs/backend-out.log',
    log_file: './logs/backend-combined.log',
    time: true,
    max_memory_restart: '500M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}
EOL

# PM2 starten/neustarten (als App-User)
echo -e "${BLUE}🔄 Starte Backend mit PM2...${NC}"
sudo -u "$APP_USER" bash -c "
cd $APP_DIR
pm2 delete fulfillment-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
"

# PM2 Startup für automatischen Start
echo -e "${BLUE}⚡ Konfiguriere PM2 Auto-Start...${NC}"
# Als root das startup template generieren
STARTUP_SCRIPT=$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | tail -1)
eval "$STARTUP_SCRIPT"

echo -e "${GREEN}✅ PM2 konfiguriert und gestartet${NC}"

# =======================================================
# 🔒 SICHERHEIT & BERECHTIGUNGEN
# =======================================================

echo -e "${YELLOW}🔒 Setze Sicherheitsberechtigungen...${NC}"

# Alle Dateien gehören dem App-User
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Uploads-Verzeichnis: www-data kann schreiben, aber nur lesen
chown -R "$APP_USER:www-data" "$APP_DIR/backend/uploads"
chmod -R 755 "$APP_DIR/backend/uploads"

# Logs nur für App-User lesbar
chmod -R 750 "$APP_DIR/logs"

# .env Datei besonders schützen
chmod 600 "$APP_DIR/backend/.env"

# Frontend Build für Webserver lesbar
chmod -R 755 "$APP_DIR/frontend/build"

echo -e "${GREEN}✅ Sicherheitsberechtigungen gesetzt${NC}"

# =======================================================
# 🔥 FIREWALL KONFIGURATION
# =======================================================

echo -e "${YELLOW}🔥 Konfiguriere Firewall...${NC}"

# UFW aktivieren (falls nicht aktiv)
ufw --force enable

# Standard-Regeln
ufw default deny incoming
ufw default allow outgoing

# SSH erlauben (WICHTIG!)
ufw allow ssh

# HTTP/HTTPS für Reverse Proxy
ufw allow 80
ufw allow 443

# Backend Port nur lokal
ufw allow from 127.0.0.1 to any port 3001

echo -e "${GREEN}✅ Firewall konfiguriert${NC}"

# =======================================================
# 📊 STATUS CHECK
# =======================================================

echo -e "${YELLOW}📊 Prüfe Installation...${NC}"

sleep 5

# PM2 Status
echo -e "${BLUE}PM2 Status:${NC}"
sudo -u "$APP_USER" pm2 status

# Port Check
echo -e "${BLUE}Port Check:${NC}"
if netstat -tlnp | grep :3001 > /dev/null; then
    echo -e "${GREEN}✅ Backend läuft auf Port 3001${NC}"
else
    echo -e "${RED}❌ Backend läuft NICHT auf Port 3001${NC}"
    echo -e "${YELLOW}💡 Logs prüfen: sudo -u $APP_USER pm2 logs${NC}"
fi

# Disk Space Check
echo -e "${BLUE}Disk Space:${NC}"
df -h "$APP_DIR"

# Node.js & npm Versionen
echo -e "${BLUE}Installed Versions:${NC}"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "PM2: $(pm2 --version)"

# =======================================================
# 🎉 ABSCHLUSS
# =======================================================

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT ERFOLGREICH ABGESCHLOSSEN!${NC}"
echo -e "${GREEN}=======================================================${NC}"

echo -e "${BLUE}📋 NÄCHSTE SCHRITTE:${NC}"
echo -e "1. ${YELLOW}Bearbeite die .env Datei:${NC}"
echo -e "   sudo nano $APP_DIR/backend/.env"
echo -e ""
echo -e "2. ${YELLOW}Starte Backend neu nach .env Änderungen:${NC}"
echo -e "   sudo -u $APP_USER pm2 restart fulfillment-backend"
echo -e ""
echo -e "3. ${YELLOW}Konfiguriere deinen externen Reverse Proxy:${NC}"
echo -e "   Backend: http://server-ip:3001"
echo -e "   Frontend: $APP_DIR/frontend/build/"
echo -e ""
echo -e "4. ${YELLOW}Logs anschauen:${NC}"
echo -e "   sudo -u $APP_USER pm2 logs fulfillment-backend"
echo -e ""
echo -e "5. ${YELLOW}PM2 Monitoring:${NC}"
echo -e "   sudo -u $APP_USER pm2 monit"

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🚀 Dein Fulfillment Portal ist bereit!${NC}"
echo -e "${GREEN}=======================================================${NC}"