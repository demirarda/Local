#!/bin/bash

# PostgreSQL Reinitialize Script
# This script will reinitialize PostgreSQL data directory

set -e

echo "🔄 PostgreSQL Reinitialize Script"
echo "=================================="
echo ""

# Step 1: Stop PostgreSQL
echo "1️⃣ Stopping PostgreSQL..."
sudo brew services stop postgresql@14 2>/dev/null || true
sudo pkill -9 postgres 2>/dev/null || true
sleep 2
echo "✅ PostgreSQL stopped"
echo ""

# Step 2: Backup old data directory
echo "2️⃣ Backing up old data directory..."
if [ -d /opt/homebrew/var/postgresql@14 ]; then
  BACKUP_NAME="postgresql@14.backup.$(date +%Y%m%d_%H%M%S)"
  sudo mv /opt/homebrew/var/postgresql@14 "/opt/homebrew/var/${BACKUP_NAME}"
  echo "✅ Old data directory backed up to: ${BACKUP_NAME}"
else
  echo "ℹ️  No existing data directory to backup"
fi
echo ""

# Step 3: Create new data directory and fix ownership
echo "3️⃣ Creating new data directory..."
sudo mkdir -p /opt/homebrew/var/postgresql@14
USER=$(whoami)
sudo chown -R "${USER}:$(id -gn)" /opt/homebrew/var/postgresql@14
echo "✅ New data directory created with correct ownership"
echo ""

# Step 4: Initialize PostgreSQL
echo "4️⃣ Initializing PostgreSQL..."
/opt/homebrew/opt/postgresql@14/bin/initdb -D /opt/homebrew/var/postgresql@14
echo "✅ PostgreSQL initialized"
echo ""

# Step 5: Start PostgreSQL
echo "5️⃣ Starting PostgreSQL..."
brew services start postgresql@14
sleep 3
echo "✅ PostgreSQL service started"
echo ""

# Step 6: Wait for PostgreSQL to be ready
echo "6️⃣ Waiting for PostgreSQL to be ready..."
for i in {1..10}; do
  if pg_isready >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  echo "   Waiting... (${i}/10)"
  sleep 1
done

if ! pg_isready >/dev/null 2>&1; then
  echo "❌ PostgreSQL is not ready after 10 seconds"
  echo "   Check logs: tail -f /opt/homebrew/var/log/postgresql@14.log"
  exit 1
fi
echo ""

# Step 7: Create database
echo "7️⃣ Creating local_db database..."
psql -U $(whoami) -d postgres -c "CREATE DATABASE local_db;" 2>&1 | grep -v "already exists" || echo "✅ Database created or already exists"
echo ""

# Step 8: Run migration
echo "8️⃣ Running migration..."
cd "$(dirname "$0")/../backend"
if [ -f "src/migrations/001_initial_schema.sql" ]; then
  psql -U $(whoami) -d local_db -f src/migrations/001_initial_schema.sql
  echo "✅ Migration completed"
else
  echo "❌ Migration file not found: src/migrations/001_initial_schema.sql"
  exit 1
fi
echo ""

# Step 9: Verify tables
echo "9️⃣ Verifying tables..."
psql -U $(whoami) -d local_db -c "\dt" 2>&1
echo ""

echo "🎉 PostgreSQL reinitialize completed successfully!"
echo ""
echo "📊 Summary:"
echo "   - PostgreSQL: ✅ Running"
echo "   - Database: ✅ local_db created"
echo "   - Tables: ✅ Migration applied"
echo ""
echo "🧪 Test connection:"
echo "   psql -U $(whoami) -d local_db -c \"SELECT 1;\""
