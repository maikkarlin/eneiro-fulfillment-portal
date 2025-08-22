#!/bin/bash

# =======================================================
# 🚀 FULFILLMENT PORTAL - FRESH SYSTEM DEPLOYMENT
# =======================================================
# Ubuntu 24.04 LTS - Komplett frisches System
# Author: Claude & User Collaboration  
# Version: 3.0 (August 2025) - FRESH SYSTEM READY
# =======================================================

set -e  # Exit on error

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Konfiguration
APP_NAME="eneiro-fulfillment-portal"
APP_USER="fulfillment"
APP_HOME="/home/$APP_USER"
APP_DIR="$APP_HOME/$APP_NAME"
GITHUB_REPO="https://github.com/maikkarlin/$APP_NAME.git"  # ANPASSEN!
NODE_VERSION="20"  # LTS Version

echo -e "${PURPLE}=======================================================${NC}"
echo -e "${PURPLE}🚀 FULFILLMENT PORTAL - FRESH SYSTEM DEPLOYMENT${NC}"
echo -e "${PURPLE}=======================================================${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo -e "${BLUE}🖥️  System: $(lsb_release -d | cut -f2)${NC}"
echo -e "${BLUE}🏗️  Deployment für: $APP_NAME${NC}"

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Dieses Script muss als root ausgeführt werden (sudo)${NC}"
   exit 1
fi

# =======================================================
# 🔧 FRISCHES SYSTEM VORBEREITEN
# =======================================================

echo -e "${YELLOW}🔧 Bereite frisches System vor...${NC}"

# Basis System-Info
echo -e "${BLUE}💾 Verfügbarer Speicher:${NC}"
df -h / | grep -E "/$"

echo -e "${BLUE}🧠 RAM:${NC}"
free -h

# Locale setzen (wichtig für frische Systeme)
export DEBIAN_FRONTEND=noninteractive
locale-gen en_US.UTF-8
update-locale LANG=en_US.UTF-8

# Zeitzone setzen (falls nicht gesetzt)
timedatectl set-timezone Europe/Berlin

echo -e "${GREEN}✅ System vorbereitet${NC}"

# =======================================================
# 📦 SYSTEM PACKAGES & UPDATES
# =======================================================

echo -e "${YELLOW}📦 System Update & Dependencies...${NC}"

# Package lists aktualisieren (mehrfach für Sicherheit)
echo -e "${BLUE}🔄 Aktualisiere Package Lists...${NC}"
apt update
apt update  # Doppelt für frische Systeme

# Vollständiges System Update
echo -e "${BLUE}⬆️  System Upgrade...${NC}"
apt upgrade -y

# Basis-Pakete für frisches System
echo -e "${BLUE}📋 Installiere Basis-Pakete...${NC}"
apt install -y \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    curl \
    wget \
    git \
    unzip \
    vim \
    nano \
    htop \
    net-tools \
    build-essential \
    python3-pip \
    nginx-light \
    ufw \
    fail2ban

echo -e "${GREEN}✅ Basis-Pakete installiert${NC}"

# =======================================================
# 🟢 NODE.JS INSTALLATION
# =======================================================

echo -e "${YELLOW}🟢 Node.js Installation...${NC}"

# Node.js Repository hinzufügen
echo -e "${BLUE}📋 Füge Node.js Repository hinzu...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -

# Node.js installieren
echo -e "${BLUE}📦 Installiere Node.js ${NODE_VERSION}...${NC}"
apt-get install -y nodejs

# Versionen prüfen
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
echo -e "${GREEN}✅ Node.js ${NODE_VER} installiert${NC}"
echo -e "${GREEN}✅ npm ${NPM_VER} installiert${NC}"

# PM2 global installieren
echo -e "${BLUE}🚀 Installiere PM2 Process Manager...${NC}"
npm install -g pm2@latest

PM2_VER=$(pm2 --version)
echo -e "${GREEN}✅ PM2 ${PM2_VER} installiert${NC}"

# =======================================================
# 👤 SICHERER APP-USER
# =======================================================

echo -e "${YELLOW}👤 Erstelle App-User '$APP_USER'...${NC}"

# User erstellen mit Home Directory
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash -G www-data "$APP_USER"
    
    # Sudoers für PM2 (nur für PM2 commands)
    echo "$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart $APP_USER-pm2, /usr/bin/systemctl start $APP_USER-pm2, /usr/bin/systemctl stop $APP_USER-pm2" > /etc/sudoers.d/$APP_USER
    
    echo -e "${GREEN}✅ User '$APP_USER' erstellt${NC}"
else
    echo -e "${BLUE}ℹ️  User '$APP_USER' existiert bereits${NC}"
fi

# SSH Verzeichnis für App-User erstellen (falls nötig)
sudo -u "$APP_USER" mkdir -p "$APP_HOME/.ssh"
sudo -u "$APP_USER" chmod 700 "$APP_HOME/.ssh"

echo -e "${GREEN}✅ App-User konfiguriert${NC}"

# =======================================================
# 📁 VERZEICHNISSE ERSTELLEN
# =======================================================

echo -e "${YELLOW}📁 Erstelle App-Verzeichnisse...${NC}"

# Alle nötigen Verzeichnisse
sudo -u "$APP_USER" mkdir -p "$APP_DIR"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/uploads/warenannahme"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backup"
sudo -u "$APP_USER" mkdir -p "$APP_HOME/.pm2"

echo -e "${GREEN}✅ Verzeichnisse erstellt${NC}"

# =======================================================
# 📥 GITHUB CODE
# =======================================================

echo -e "${YELLOW}📥 Code von GitHub laden...${NC}"

# Git Konfiguration für App-User
sudo -u "$APP_USER" git config --global init.defaultBranch main
sudo -u "$APP_USER" git config --global user.name "Fulfillment Deployment"
sudo -u "$APP_USER" git config --global user.email "deploy@localhost"

# Repository klonen
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${BLUE}ℹ️  Repository existiert - Update...${NC}"
    cd "$APP_DIR"
    sudo -u "$APP_USER" git fetch --all
    sudo -u "$APP_USER" git reset --hard origin/main
    sudo -u "$APP_USER" git pull origin main
else
    echo -e "${BLUE}ℹ️  Klone Repository...${NC}"
    sudo -u "$APP_USER" git clone "$GITHUB_REPO" "$APP_DIR"
fi

cd "$APP_DIR"
echo -e "${GREEN}✅ Code geladen${NC}"

# =======================================================
# 🔧 BACKEND SETUP
# =======================================================

echo -e "${YELLOW}🔧 Backend Setup...${NC}"

cd "$APP_DIR/backend"

# Package.json prüfen
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Fehler: package.json nicht gefunden in backend/!${NC}"
    echo -e "${YELLOW}💡 Prüfe deine GitHub Repository Struktur${NC}"
    exit 1
fi

# Dependencies installieren
echo -e "${BLUE}📦 Backend Dependencies...${NC}"
sudo -u "$APP_USER" npm install --production --silent

# Environment Datei erstellen
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Erstelle .env...${NC}"
    sudo -u "$APP_USER" cat > .env << 'EOL'
# ===========================================
# FULFILLMENT PORTAL - PRODUCTION CONFIG
# ===========================================

# Datenbank Konfiguration (ANPASSEN!)
DB_SERVER=DEIN_WINDOWS_SERVER_IP
DB_DATABASE=DEINE_JTL_DATENBANK
DB_USER=DEIN_DB_USER
DB_PASSWORD=DEIN_DB_PASSWORD
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT Secret (32+ Zeichen!)
JWT_SECRET=super_sicherer_jwt_secret_mindestens_32_zeichen_lang

# Server Konfiguration
PORT=3001
NODE_ENV=production
HOST=localhost

# Upload Konfiguration
UPLOAD_MAX_SIZE=50MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Logging
LOG_LEVEL=info

# ===========================================
EOL
    
    echo -e "${RED}⚠️  WICHTIG: .env konfigurieren!${NC}"
    echo -e "${YELLOW}   sudo nano $APP_DIR/backend/.env${NC}"
fi

echo -e "${GREEN}✅ Backend konfiguriert${NC}"

# =======================================================
# 🎨 FRONTEND BUILD
# =======================================================

echo -e "${YELLOW}🎨 Frontend Build...${NC}"

cd "$APP_DIR/frontend"

# Package.json prüfen
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Fehler: package.json nicht gefunden in frontend/!${NC}"
    exit 1
fi

# Dependencies installieren
echo -e "${BLUE}📦 Frontend Dependencies...${NC}"
sudo -u "$APP_USER" npm install --silent

# Production Build
echo -e "${BLUE}🏗️  Production Build...${NC}"
sudo -u "$APP_USER" npm run build

# Build-Ordner prüfen
if [ ! -d "build" ]; then
    echo -e "${RED}❌ Frontend Build fehlgeschlagen!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend Build erfolgreich${NC}"

# =======================================================
# 🚀 PM2 PROCESS MANAGER
# =======================================================

echo -e "${YELLOW}🚀 PM2 Konfiguration...${NC}"

cd "$APP_DIR"

# PM2 Ecosystem
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
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads']
  }]
}
EOL

# PM2 starten
echo -e "${BLUE}▶️  Starte PM2...${NC}"
sudo -u "$APP_USER" bash -c "
cd $APP_DIR
pm2 delete fulfillment-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
"

# Auto-Start konfigurieren
echo -e "${BLUE}⚡ Auto-Start Setup...${NC}"
STARTUP_CMD=$(sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | tail -1)
if [[ $STARTUP_CMD == sudo* ]]; then
    eval "$STARTUP_CMD"
fi

echo -e "${GREEN}✅ PM2 läuft${NC}"

# =======================================================
# 🔒 SICHERHEIT
# =======================================================

echo -e "${YELLOW}🔒 Sicherheit konfigurieren...${NC}"

# File Permissions
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:www-data" "$APP_DIR/backend/uploads"
chmod -R 755 "$APP_DIR/backend/uploads"
chmod -R 750 "$APP_DIR/logs"
chmod 600 "$APP_DIR/backend/.env"
chmod -R 755 "$APP_DIR/frontend/build"

# Firewall
echo -e "${BLUE}🔥 Firewall Setup...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow from 127.0.0.1 to any port 3001

# Fail2ban für SSH
systemctl enable fail2ban
systemctl start fail2ban

echo -e "${GREEN}✅ Sicherheit konfiguriert${NC}"

# =======================================================
# 📊 SYSTEM CHECK
# =======================================================

echo -e "${YELLOW}📊 System Check...${NC}"

sleep 3

# Service Status
echo -e "${BLUE}🔍 Service Status:${NC}"
sudo -u "$APP_USER" pm2 status

# Port Check
echo -e "${BLUE}🔌 Port Check:${NC}"
if netstat -tlnp | grep :3001 > /dev/null; then
    echo -e "${GREEN}✅ Backend Port 3001 aktiv${NC}"
else
    echo -e "${RED}❌ Backend Port 3001 NICHT aktiv${NC}"
    echo -e "${YELLOW}💡 Logs: sudo -u $APP_USER pm2 logs${NC}"
fi

# System Resources
echo -e "${BLUE}💻 System Status:${NC}"
echo "CPU Load: $(uptime | awk -F'load average:' '{ print $2 }')"
echo "Memory: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')"
echo "Disk: $(df -h / | awk 'NR==2{print $5}')"

# Software Versions
echo -e "${BLUE}📋 Installed Versions:${NC}"
echo "Ubuntu: $(lsb_release -rs)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"  
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"

# =======================================================
# 🎉 SUCCESS
# =======================================================

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🎉 FRESH SYSTEM DEPLOYMENT ERFOLGREICH!${NC}"
echo -e "${GREEN}=======================================================${NC}"

echo -e "${PURPLE}📋 NÄCHSTE SCHRITTE:${NC}"
echo -e ""
echo -e "${YELLOW}1. 🔑 Datenbank konfigurieren:${NC}"
echo -e "   sudo nano $APP_DIR/backend/.env"
echo -e ""
echo -e "${YELLOW}2. 🔄 Backend neu starten:${NC}"
echo -e "   sudo -u $APP_USER pm2 restart fulfillment-backend"
echo -e ""
echo -e "${YELLOW}3. 🌐 Reverse Proxy Setup:${NC}"
echo -e "   Backend API: http://localhost:3001"
echo -e "   Frontend: $APP_DIR/frontend/build/"
echo -e ""
echo -e "${YELLOW}4. 📊 Monitoring:${NC}"
echo -e "   sudo -u $APP_USER pm2 logs"
echo -e "   sudo -u $APP_USER pm2 monit"
echo -e ""
echo -e "${YELLOW}5. 🔄 Updates:${NC}"
echo -e "   ./update.sh  (für spätere Updates)"

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🚀 FULFILLMENT PORTAL READY FOR PRODUCTION!${NC}"
echo -e "${GREEN}=======================================================${NC}"