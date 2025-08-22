#!/bin/bash

# =======================================================
# 🚀 ENEIRO FULFILLMENT PORTAL - DEPLOYMENT SCRIPT
# =======================================================
# Ubuntu 24.04 LTS - Korrekte GitHub Integration
# Repository: eneiro-fulfillment-portal
# User: maikkarlin
# Version: 4.0 (August 2025) - KORREKTE GITHUB STRUKTUR
# =======================================================

set -e  # Exit on error

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# ====== KORREKTE KONFIGURATION ======
APP_NAME="eneiro-fulfillment-portal"
APP_USER="fulfillment"
APP_HOME="/home/$APP_USER"
APP_DIR="$APP_HOME/$APP_NAME"
GITHUB_REPO="https://github.com/maikkarlin/eneiro-fulfillment-portal.git"
NODE_VERSION="20"  # LTS Version
BACKEND_PORT="5000"  # ✅ KORREKT: Server läuft auf Port 5000

echo -e "${PURPLE}=======================================================${NC}"
echo -e "${PURPLE}🚀 ENEIRO FULFILLMENT PORTAL DEPLOYMENT${NC}"
echo -e "${PURPLE}=======================================================${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo -e "${BLUE}🖥️  System: $(lsb_release -d | cut -f2)${NC}"
echo -e "${BLUE}🏗️  Repository: maikkarlin/eneiro-fulfillment-portal${NC}"
echo -e "${BLUE}🌐 Backend Port: $BACKEND_PORT${NC}"

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

# Package lists aktualisieren
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
    echo -e "${GREEN}✅ User '$APP_USER' erstellt${NC}"
else
    echo -e "${BLUE}ℹ️  User '$APP_USER' existiert bereits${NC}"
fi

# SSH Verzeichnis für App-User erstellen (falls nötig)
sudo -u "$APP_USER" mkdir -p "$APP_HOME/.ssh"
sudo -u "$APP_USER" chmod 700 "$APP_HOME/.ssh"

echo -e "${GREEN}✅ App-User konfiguriert${NC}"

# =======================================================
# 📁 VERZEICHNISSE ERSTELLEN (KORREKT!)
# =======================================================

echo -e "${YELLOW}📁 Erstelle App-Verzeichnisse...${NC}"

# Alle nötigen Verzeichnisse basierend auf der echten Struktur
sudo -u "$APP_USER" mkdir -p "$APP_DIR"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/uploads"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/uploads/warenannahme"  # ✅ Für Fotos
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/uploads/documents"     # ✅ Für PDFs
sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backup"
sudo -u "$APP_USER" mkdir -p "$APP_HOME/.pm2"

echo -e "${GREEN}✅ Alle Upload-Verzeichnisse erstellt${NC}"

# =======================================================
# 📥 GITHUB CODE (KORREKT!)
# =======================================================

echo -e "${YELLOW}📥 Code von GitHub laden...${NC}"

# Git Konfiguration für App-User
sudo -u "$APP_USER" git config --global init.defaultBranch main
sudo -u "$APP_USER" git config --global user.name "Eneiro Deployment"
sudo -u "$APP_USER" git config --global user.email "deploy@eneiro.io"

# Repository klonen
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${BLUE}ℹ️  Repository existiert - Update...${NC}"
    cd "$APP_DIR"
    sudo -u "$APP_USER" git fetch --all
    sudo -u "$APP_USER" git reset --hard origin/main
    sudo -u "$APP_USER" git pull origin main
else
    echo -e "${BLUE}ℹ️  Klone Repository: maikkarlin/eneiro-fulfillment-portal${NC}"
    sudo -u "$APP_USER" git clone "$GITHUB_REPO" "$APP_DIR"
fi

cd "$APP_DIR"
echo -e "${GREEN}✅ Code von GitHub geladen${NC}"

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
# ENEIRO FULFILLMENT PORTAL - PRODUCTION CONFIG
# ===========================================

# Datenbank Konfiguration (ANPASSEN!)
DB_SERVER=DEIN_WINDOWS_SERVER_IP
DB_DATABASE=DEINE_JTL_DATENBANK
DB_USER=DEIN_DB_USER
DB_PASSWORD=DEIN_DB_PASSWORD
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT Secret (32+ Zeichen!)
JWT_SECRET=super_sicherer_jwt_secret_mindestens_32_zeichen_lang_fuer_eneiro

# Server Konfiguration (KORREKT!)
PORT=5000
NODE_ENV=production
HOST=0.0.0.0

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
# 🚀 PM2 PROCESS MANAGER (KORREKT!)
# =======================================================

echo -e "${YELLOW}🚀 PM2 Konfiguration...${NC}"

cd "$APP_DIR"

# PM2 Ecosystem mit korrekten Pfaden
sudo -u "$APP_USER" cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'eneiro-fulfillment-backend',
    script: './backend/server.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $BACKEND_PORT
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
pm2 delete eneiro-fulfillment-backend 2>/dev/null || true
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

# Firewall (KORREKTE PORTS!)
echo -e "${BLUE}🔥 Firewall Setup...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow from 127.0.0.1 to any port $BACKEND_PORT  # ✅ Port 5000

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
echo -e "${BLUE}🔍 PM2 Status:${NC}"
sudo -u "$APP_USER" pm2 status

# Port Check (KORREKT!)
echo -e "${BLUE}🔌 Port Check:${NC}"
if netstat -tlnp | grep :$BACKEND_PORT > /dev/null; then
    echo -e "${GREEN}✅ Backend Port $BACKEND_PORT aktiv${NC}"
else
    echo -e "${RED}❌ Backend Port $BACKEND_PORT NICHT aktiv${NC}"
    echo -e "${YELLOW}💡 Logs: sudo -u $APP_USER pm2 logs${NC}"
fi

# Upload-Verzeichnisse prüfen
echo -e "${BLUE}📁 Upload-Verzeichnisse:${NC}"
for dir in "uploads" "uploads/warenannahme" "uploads/documents"; do
    if [ -d "$APP_DIR/backend/$dir" ]; then
        echo -e "  ${GREEN}✅ $dir${NC}"
    else
        echo -e "  ${RED}❌ $dir${NC}"
    fi
done

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

# =======================================================
# 🎉 SUCCESS
# =======================================================

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🎉 ENEIRO FULFILLMENT PORTAL DEPLOYMENT ERFOLGREICH!${NC}"
echo -e "${GREEN}=======================================================${NC}"

echo -e "${PURPLE}📋 NÄCHSTE SCHRITTE:${NC}"
echo -e ""
echo -e "${YELLOW}1. 🔑 Datenbank konfigurieren:${NC}"
echo -e "   sudo nano $APP_DIR/backend/.env"
echo -e ""
echo -e "${YELLOW}2. 🔄 Backend neu starten:${NC}"
echo -e "   sudo -u $APP_USER pm2 restart eneiro-fulfillment-backend"
echo -e ""
echo -e "${YELLOW}3. 🌐 Reverse Proxy Setup:${NC}"
echo -e "   Backend API: http://localhost:$BACKEND_PORT"
echo -e "   Frontend: $APP_DIR/frontend/build/"
echo -e ""
echo -e "${YELLOW}4. 📊 Monitoring:${NC}"
echo -e "   sudo -u $APP_USER pm2 logs eneiro-fulfillment-backend"
echo -e "   sudo -u $APP_USER pm2 monit"
echo -e ""
echo -e "${YELLOW}5. 🔄 Updates:${NC}"
echo -e "   curl -o update.sh https://raw.githubusercontent.com/maikkarlin/eneiro-fulfillment-portal/main/update.sh"

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🚀 READY: https://ffn.eneiro.io${NC}"
echo -e "${GREEN}=======================================================${NC}"