#!/bin/bash
# Expo start with minimal file watching
# Uses Watchman if available, otherwise falls back to limited watching

ulimit -n 65536

# Try Watchman first (most efficient)
export EXPO_NO_WATCHMAN=false

# Don't use CI mode - it breaks module resolution
# Instead, rely on Metro config optimizations

echo "✅ Expo başlatılıyor (optimize edilmiş file watching)"
echo "💡 Manuel reload için Terminal'de 'r' tuşuna basın"
echo ""

# Start Expo normally - Metro config handles file watching optimization
npx expo start "$@"
