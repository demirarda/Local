#!/bin/bash

# Fix current state and retry initialization

echo "🔧 Fixing current state..."
echo ""

# Remove the partially created directory
echo "Removing partially created directory..."
sudo rm -rf /opt/homebrew/var/postgresql@14
echo "✅ Directory removed"
echo ""

# Now run the init script again
echo "Running initialization script..."
./scripts/init_postgresql.sh
