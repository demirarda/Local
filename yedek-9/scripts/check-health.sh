#!/bin/bash

# LOCAL Health Check Script
# Checks if all required services are running

echo "🏥 LOCAL - Health Check"
echo "======================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check PostgreSQL
echo -n "PostgreSQL: "
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    
    # Check if database exists
    echo -n "  Database (local_db): "
    if psql -U $(whoami) -d local_db -c "SELECT 1;" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Accessible${NC}"
    else
      echo -e "${RED}❌ Not accessible${NC}"
      echo "     Run: psql -U $(whoami) -d postgres -c \"CREATE DATABASE local_db;\""
    fi
  else
    echo -e "${RED}❌ Not running${NC}"
    echo "     Start with: brew services start postgresql@14"
  fi
else
  echo -e "${YELLOW}⚠️  Not installed${NC}"
fi

# Check Redis
echo -n "Redis: "
if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
  else
    echo -e "${RED}❌ Not running${NC}"
    echo "     Start with: brew services start redis"
  fi
else
  echo -e "${YELLOW}⚠️  Not installed${NC}"
fi

# Check Backend
echo -n "Backend API: "
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Running${NC}"
  
  # Get health status
  HEALTH=$(curl -s http://localhost:3000/health)
  if [ ! -z "$HEALTH" ]; then
    echo "  Response: $HEALTH"
  fi
else
  echo -e "${RED}❌ Not running${NC}"
  echo "     Start with: cd backend && npm run dev"
fi

# Check Environment Files
echo ""
echo "Environment Files:"
echo -n "  backend/.env: "
if [ -f backend/.env ]; then
  echo -e "${GREEN}✅ Exists${NC}"
else
  echo -e "${RED}❌ Missing${NC}"
  echo "     Run: ./scripts/setup-local.sh"
fi

echo -n "  mobile/.env: "
if [ -f mobile/.env ]; then
  echo -e "${GREEN}✅ Exists${NC}"
else
  echo -e "${RED}❌ Missing${NC}"
  echo "     Run: ./scripts/setup-local.sh"
fi

# Check Node.js
echo ""
echo "Dependencies:"
echo -n "  Node.js: "
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v)
  echo -e "${GREEN}✅ $NODE_VERSION${NC}"
else
  echo -e "${RED}❌ Not installed${NC}"
fi

echo -n "  npm: "
if command -v npm >/dev/null 2>&1; then
  NPM_VERSION=$(npm -v)
  echo -e "${GREEN}✅ $NPM_VERSION${NC}"
else
  echo -e "${RED}❌ Not installed${NC}"
fi

# Check if node_modules exist
echo -n "  Backend dependencies: "
if [ -d backend/node_modules ]; then
  echo -e "${GREEN}✅ Installed${NC}"
else
  echo -e "${YELLOW}⚠️  Not installed${NC}"
  echo "     Run: cd backend && npm install"
fi

echo -n "  Mobile dependencies: "
if [ -d mobile/node_modules ]; then
  echo -e "${GREEN}✅ Installed${NC}"
else
  echo -e "${YELLOW}⚠️  Not installed${NC}"
  echo "     Run: cd mobile && npm install"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
