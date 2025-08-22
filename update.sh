#!/bin/bash

# =======================================================
# 🔄 ENEIRO FULFILLMENT PORTAL - QUICK UPDATE SCRIPT
# =======================================================
# Für schnelle Updates von GitHub (maikkarlin/eneiro-fulfillment-portal)
# =======================================================

set -e

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

APP_USER="fulfillment"
APP_DIR="/home/$APP_USER/eneiro-fulfillment-portal"  # ✅ KORREKTER NAME
PM2_APP_NAME="eneiro-fulfillment-backend"             # ✅ KORREKTER PM2 NAME

echo -e "${BLUE}🔄 ENEIRO FULFILLMENT PORTAL - QUICK UPDATE${NC}"
echo -e "${BLUE}📅 $(date)${NC}"

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

cd "$APP_DIR"

echo -e "\033[1;33m📥 GitHub Update (maikkarlin/eneiro-fulfillment-portal)...\033[0m"
git fetch --all
git reset --hard origin/main
git pull origin main

echo -e "\033[1;33m🔧 Backend Update...\033[0m"
cd backend
npm install --production --silent

echo -e "\033[1;33m🎨 Frontend Build...\033[0m"
cd ../frontend
npm install --silent
npm run build

echo -e "\033[1;33m🚀 Backend Restart...\033[0m"
pm2 restart $PM2_APP_NAME

echo -e "\033[0;32m✅ Update abgeschlossen!\033[0m"
pm2 status | grep $PM2_APP_NAME
EOF

echo -e "${GREEN}🎉 UPDATE ERFOLGREICH!${NC}"
echo -e "${BLUE}📊 PM2 Status:${NC}"
sudo -u "$APP_USER" pm2 status

echo -e "${YELLOW}💡 Weitere Befehle:${NC}"
echo -e "   Logs: sudo -u fulfillment pm2 logs eneiro-fulfillment-backend"
echo -e "   Monitor: sudo -u fulfillment pm2 monit"
echo -e "   Stop: sudo -u fulfillment pm2 stop eneiro-fulfillment-backend"
echo -e "   Start: sudo -u fulfillment pm2 start eneiro-fulfillment-backend"