#!/bin/bash

# =======================================================
# 🔄 ENEIRO FULFILLMENT PORTAL - IMPROVED UPDATE SCRIPT
# =======================================================
# Basierend auf Production-Erkenntnissen
# Automatische Fixes für bekannte Probleme
# Version: 3.0 (August 2025)
# =======================================================

set -e

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

APP_USER="fulfillment"
APP_DIR="/home/$APP_USER/eneiro-fulfillment-portal"  # ✅ KORREKTER NAME
PM2_APP_NAME="eneiro-fulfillment-backend"             # ✅ KORREKTER PM2 NAME
FRONTEND_TARGET="/var/www/fulfillment-portal"         # ✅ NGINX ZIEL

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}🔄 ENEIRO FULFILLMENT PORTAL - UPDATE${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo -e "${PURPLE}📅 $(date)${NC}"
echo -e "${PURPLE}🔧 Mit automatischen Production-Fixes${NC}"

# Prüfe ob App-Verzeichnis existiert
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ App-Verzeichnis nicht gefunden: $APP_DIR${NC}"
    echo -e "${YELLOW}💡 Führe zuerst das Deployment-Script aus!${NC}"
    exit 1
fi

# Als App-User wechseln und Update durchführen
sudo -u "$APP_USER" bash << 'EOF'
set -e

APP_DIR="/home/fulfillment/eneiro-fulfillment-portal"
PM2_APP_NAME="eneiro-fulfillment-backend"

echo -e "\033[1;33m📥 GitHub Update (maikkarlin/eneiro-fulfillment-portal)...\033[0m"
cd "$APP_DIR"
git fetch --all
git reset --hard origin/main
git pull origin main

echo -e "\033[0;32m✅ Code aktualisiert\033[0m"

# =======================================================
# 🔧 KRITISCHE FIXES (basierend auf Production-Problemen)
# =======================================================

echo -e "\033[1;33m🔧 Wende kritische Fixes an...\033[0m"

# Fix 1: Upload-Pfade in goodsReceipt.js reparieren
if [ -f "backend/routes/goodsReceipt.js" ]; then
    echo -e "\033[0;34m🔧 Repariere Upload-Pfad in goodsReceipt.js\033[0m"
    sed -i "s|'\./uploads/warenannahme'|'\./backend/uploads/warenannahme'|g" backend/routes/goodsReceipt.js
    sed -i 's|"./uploads/warenannahme"|"./backend/uploads/warenannahme"|g' backend/routes/goodsReceipt.js
fi

# Fix 2: Upload-Pfade in documents.js reparieren
if [ -f "backend/routes/documents.js" ]; then
    echo -e "\033[0;34m🔧 Repariere Upload-Pfad in documents.js\033[0m"
    sed -i "s|'uploads/documents'|'./backend/uploads/documents'|g" backend/routes/documents.js
    sed -i 's|"uploads/documents"|"./backend/uploads/documents"|g' backend/routes/documents.js
fi

# Fix 3: .env Datei ins richtige Verzeichnis kopieren
if [ -f "backend/.env" ] && [ ! -f ".env" ]; then
    echo -e "\033[0;34m🔧 Kopiere .env ins Hauptverzeichnis\033[0m"
    cp backend/.env .
fi

# Fix 4: Frontend localhost URLs reparieren
echo -e "\033[0;34m🔧 Repariere Frontend API URLs\033[0m"
find frontend/src -name "*.js" -exec sed -i 's|http://localhost:5000/api|/api|g' {} \; 2>/dev/null || true
find frontend/src -name "*.js" -exec sed -i 's|http://localhost:3001/api|/api|g' {} \; 2>/dev/null || true

# Fix 5: Upload-Verzeichnisse erstellen falls nicht vorhanden
mkdir -p backend/uploads/warenannahme
mkdir -p backend/uploads/documents

echo -e "\033[0;32m✅ Kritische Fixes angewendet\033[0m"

# =======================================================
# 📦 BACKEND UPDATE
# =======================================================

echo -e "\033[1;33m🔧 Backend Update...\033[0m"
cd backend

# Dependencies installieren
npm install --production --silent

# Upload-Verzeichnisse sicherstellen
mkdir -p uploads/warenannahme uploads/documents
chmod -R 755 uploads/

echo -e "\033[0;32m✅ Backend aktualisiert\033[0m"

# =======================================================
# 🎨 FRONTEND BUILD & DEPLOY
# =======================================================

echo -e "\033[1;33m🎨 Frontend Build...\033[0m"
cd ../frontend

# Dependencies installieren
npm install --silent

# Production Build
npm run build

echo -e "\033[0;32m✅ Frontend Build abgeschlossen\033[0m"

# =======================================================
# 🚀 PM2 RESTART
# =======================================================

echo -e "\033[1;33m🚀 Backend Restart...\033[0m"
pm2 restart $PM2_APP_NAME

echo -e "\033[0;32m✅ Backend neu gestartet\033[0m"

# =======================================================
# 📊 STATUS CHECK
# =======================================================

echo -e "\033[1;33m📊 Status Check...\033[0m"
pm2 status | grep $PM2_APP_NAME
EOF

# =======================================================
# 🌐 FRONTEND DEPLOYMENT (als root)
# =======================================================

echo -e "${YELLOW}🌐 Deploy Frontend zu Nginx...$NC"

# Frontend nach /var/www kopieren
if [ -d "$APP_DIR/frontend/build" ]; then
    sudo cp -r "$APP_DIR/frontend/build/"* "$FRONTEND_TARGET/"
    sudo chown -R www-data:www-data "$FRONTEND_TARGET"
    sudo chmod -R 755 "$FRONTEND_TARGET"
    echo -e "${GREEN}✅ Frontend deployed zu $FRONTEND_TARGET${NC}"
else
    echo -e "${RED}❌ Frontend Build nicht gefunden!${NC}"
    exit 1
fi

# =======================================================
# 🔒 BERECHTIGUNGEN REPARIEREN
# =======================================================

echo -e "${YELLOW}🔒 Berechtigungen reparieren...${NC}"

# Upload-Ordner Berechtigungen
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend/uploads"
sudo chmod -R 755 "$APP_DIR/backend/uploads"

# .env Datei schützen
sudo chmod 600 "$APP_DIR/.env" 2>/dev/null || true
sudo chmod 600 "$APP_DIR/backend/.env" 2>/dev/null || true

echo -e "${GREEN}✅ Berechtigungen gesetzt${NC}"

# =======================================================
# 📊 FINAL STATUS CHECK
# =======================================================

echo -e "${YELLOW}📊 System Status Check...${NC}"

# PM2 Status
echo -e "${BLUE}PM2 Status:${NC}"
sudo -u "$APP_USER" pm2 status

# Port Check
echo -e "${BLUE}Port Check:${NC}"
if netstat -tlnp | grep :5000 > /dev/null; then
    echo -e "${GREEN}✅ Backend Port 5000 aktiv${NC}"
else
    echo -e "${RED}❌ Backend Port 5000 nicht aktiv${NC}"
fi

# Nginx Status
echo -e "${BLUE}Nginx Status:${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx läuft${NC}"
else
    echo -e "${RED}❌ Nginx läuft nicht${NC}"
fi

# Upload-Verzeichnisse
echo -e "${BLUE}Upload-Verzeichnisse:${NC}"
for dir in "uploads/warenannahme" "uploads/documents"; do
    if [ -d "$APP_DIR/backend/$dir" ]; then
        file_count=$(ls -1 "$APP_DIR/backend/$dir" 2>/dev/null | wc -l)
        echo -e "  ${GREEN}✅ $dir ($file_count Dateien)${NC}"
    else
        echo -e "  ${RED}❌ $dir${NC}"
    fi
done

# =======================================================
# 🎉 SUCCESS
# =======================================================

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}🎉 UPDATE ERFOLGREICH ABGESCHLOSSEN!${NC}"
echo -e "${GREEN}=======================================================${NC}"

echo -e "${PURPLE}📋 Update Summary:${NC}"
echo -e "✅ Code von GitHub aktualisiert"
echo -e "✅ Upload-Pfade automatisch repariert"  
echo -e "✅ Frontend localhost URLs gefixt"
echo -e "✅ Backend Dependencies aktualisiert"
echo -e "✅ Frontend neu gebaut und deployed"
echo -e "✅ PM2 Backend neu gestartet"
echo -e "✅ Berechtigungen korrekt gesetzt"

echo -e "${BLUE}🌐 Portal erreichbar unter:${NC}"
echo -e "   https://portal.infra-gw.io"

echo -e "${YELLOW}💡 Nützliche Befehle:${NC}"
echo -e "   Logs: sudo -u fulfillment pm2 logs $PM2_APP_NAME"
echo -e "   Monitor: sudo -u fulfillment pm2 monit"
echo -e "   Restart: sudo -u fulfillment pm2 restart $PM2_APP_NAME"

echo -e "${GREEN}=======================================================${NC}