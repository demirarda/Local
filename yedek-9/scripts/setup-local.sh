#!/bin/bash

echo "🚀 LOCAL - Local Development Setup"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Install from: https://nodejs.org/"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "⚠️  Node.js version should be 18+. Current: $(node -v)"
fi

command -v psql >/dev/null 2>&1 || { echo "⚠️  PostgreSQL is recommended but not installed. Install from: https://www.postgresql.org/download/"; }
command -v redis-cli >/dev/null 2>&1 || { echo "⚠️  Redis is recommended but not installed. Install from: https://redis.io/download"; }

echo "✅ Prerequisites check complete"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend || { echo "❌ backend/ directory not found"; exit 1; }

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
  else
    echo "⚠️  .env.example not found, creating basic .env..."
    cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://localhost:5432/local_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=local_db
DB_USER=
DB_PASSWORD=

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:19006

# JWT Configuration
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5000
EOF
    echo "✅ Created basic .env file"
  fi
  echo "⚠️  Please edit backend/.env with your database credentials"
else
  echo "ℹ️  .env file already exists, skipping..."
fi

echo "📦 Installing backend dependencies..."
npm install
echo "✅ Backend dependencies installed"
echo ""

# Mobile setup
echo "📱 Setting up mobile app..."
cd ../mobile || { echo "❌ mobile/ directory not found"; exit 1; }

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
  else
    echo "⚠️  .env.example not found, creating basic .env..."
    cat > .env << 'EOF'
# API Configuration
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
EXPO_PUBLIC_WS_URL=http://localhost:3000
EOF
    echo "✅ Created basic .env file"
  fi
else
  echo "ℹ️  .env file already exists, skipping..."
fi

echo "📦 Installing mobile dependencies..."
npm install
echo "✅ Mobile dependencies installed"
echo ""

# Database setup
echo "🗄️  Setting up database..."

if command -v psql >/dev/null 2>&1; then
  if pg_isready >/dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
    
    read -p "Create database 'local_db'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      psql -U $(whoami) -d postgres -c "CREATE DATABASE local_db;" 2>/dev/null || echo "ℹ️  Database might already exist"
      echo "✅ Database setup complete"
    fi
    
    read -p "Run migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      cd ../backend
      npm run migrate
      echo "✅ Migrations completed"
    fi
  else
    echo "⚠️  PostgreSQL is not running"
    echo "   Start it with: brew services start postgresql@14"
  fi
else
  echo "⚠️  PostgreSQL not found, skipping database setup"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env with your database credentials (if needed)"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start mobile: cd mobile && npm start"
echo ""
echo "💡 Tip: Use './scripts/dev.sh' to start both servers at once"
