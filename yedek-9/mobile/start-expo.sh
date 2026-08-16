#!/bin/bash
# Expo start script with optimized file watching

# Set file descriptor limit
ulimit -n 65536

# Force Watchman usage
export EXPO_NO_WATCHMAN=false
export WATCHMAN_DISABLE_NODEWATCHER=1

# Start Expo
npx expo start "$@"
