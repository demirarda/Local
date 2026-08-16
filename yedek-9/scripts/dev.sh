#!/bin/bash

# LOCAL Development Helper
# Starts both backend and mobile app servers

echo "🚀 LOCAL - Starting Development Servers"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if Redis is running
if command -v redis-cli >/dev/null 2>&1; then
  if ! redis-cli ping > /dev/null 2>&1; then
    echo "🔄 Starting Redis..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew services start redis 2>/dev/null || redis-server --daemonize yes
    else
      redis-server --daemonize yes 2>/dev/null || echo "⚠️  Could not start Redis automatically"
    fi
    sleep 1
  fi
  echo "✅ Redis is running"
else
  echo "⚠️  Redis not found, continuing without it..."
fi

echo ""

# Start Backend
echo "🔧 Starting backend server..."
cd "$PROJECT_DIR/backend" || { echo "❌ backend/ directory not found"; exit 1; }

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found in backend/"
  echo "   Run './scripts/setup-local.sh' first"
  exit 1
fi

# Start backend in background
npm run dev > /tmp/local-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend started successfully
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ Backend is running on http://localhost:3000"
else
  echo "⚠️  Backend might not be ready yet, check logs: tail -f /tmp/local-backend.log"
fi

echo ""

# Start Mobile
echo "📱 Starting mobile app (Expo)..."
cd "$PROJECT_DIR/mobile" || { echo "❌ mobile/ directory not found"; exit 1; }

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found in mobile/"
  echo "   Run './scripts/setup-local.sh' first"
  exit 1
fi

# Start mobile in background
npm start > /tmp/local-mobile.log 2>&1 &
MOBILE_PID=$!

echo "✅ Mobile app starting..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Both servers started!"
echo ""
echo "📡 Backend: http://localhost:3000"
echo "📱 Mobile: Check terminal output for Expo URL"
echo ""
echo "📋 Logs:"
echo "   Backend: tail -f /tmp/local-backend.log"
echo "   Mobile:  tail -f /tmp/local-mobile.log"
echo ""
echo "🛑 Press Ctrl+C to stop all servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Stopping servers..."
  kill $BACKEND_PID $MOBILE_PID 2>/dev/null
  echo "✅ Servers stopped"
  exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Wait for processes
wait
