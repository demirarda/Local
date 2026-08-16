#!/bin/bash
# Expo start - FIXED VERSION with proper Watchman setup

# Increase file descriptor limit
ulimit -n 65536

# Create Watchman directory with proper permissions
mkdir -p ~/.local/state/watchman 2>/dev/null || {
    echo "⚠️  Watchman dizini oluşturulamadı. Sudo ile deneyin:"
    echo "   sudo mkdir -p ~/.local/state/watchman"
    echo "   sudo chown -R \$(whoami) ~/.local/state/watchman"
    echo ""
    echo "Alternatif: ./start-expo-polling.sh kullanın"
    exit 1
}

chmod 755 ~/.local/state/watchman 2>/dev/null

# Force Watchman usage
export EXPO_NO_WATCHMAN=false

echo "✅ Expo başlatılıyor (Watchman ile)"
echo "💡 Manuel reload için Terminal'de 'r' tuşuna basın"
echo ""

# Start Expo
npx expo start "$@"
