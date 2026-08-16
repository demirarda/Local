#!/bin/bash
# Expo start - SAFE VERSION that works without EMFILE errors
# Uses Metro config optimizations instead of disabling file watching

ulimit -n 65536

# Force Watchman (if available and working)
export EXPO_NO_WATCHMAN=false

echo "✅ Expo başlatılıyor (güvenli mod)"
echo "💡 Metro config file watching'i optimize ediyor"
echo ""

# Clear cache first
rm -rf .expo node_modules/.cache 2>/dev/null

# Start Expo
npx expo start --clear "$@"
