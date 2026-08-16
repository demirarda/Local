#!/bin/bash
# Expo start with Watchman (prevents EMFILE errors)

# Increase file descriptor limit
ulimit -n 65536

# CRITICAL: Force Watchman usage (prevents NodeWatcher EMFILE errors)
export EXPO_NO_WATCHMAN=false

# Ensure Watchman is used
if ! command -v watchman &> /dev/null; then
    echo "⚠️  Watchman bulunamadı! Yüklemek için: brew install watchman"
    exit 1
fi

# Initialize Watchman if needed
mkdir -p ~/.local/state/watchman 2>/dev/null
chmod 755 ~/.local/state/watchman 2>/dev/null

echo "✅ Expo başlatılıyor (Watchman ile)"
echo "💡 Manuel reload için Terminal'de 'r' tuşuna basın"
echo ""

# Start Expo - Metro will use Watchman automatically
npx expo start "$@"
