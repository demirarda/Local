#!/bin/bash

# Create RS History via API endpoints
# This script creates test data using the API instead of direct database access

USER_ID="e7bac5bc-4793-4f9b-b945-27228ab4e649"
API_BASE="http://localhost:3000"

echo "📊 Creating RS History via API for User: $USER_ID"
echo ""

# 1. Check if user exists
echo "1️⃣ Checking user..."
USER_RESPONSE=$(curl -s "$API_BASE/api/users/$USER_ID")
echo "User response: $USER_RESPONSE"
echo ""

# 2. Create a test ritual
echo "2️⃣ Creating test ritual..."
RITUAL_DATA=$(cat <<EOF
{
  "title": "Test RS Ritual 1",
  "type": "Study",
  "venue_name": "Test Venue",
  "start_time": "$(date -u -v-30d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "30 days ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "duration": 60,
  "capacity": 10,
  "entry_type": "open",
  "location_lat": 41.0082,
  "location_lng": 28.9784
}
EOF
)

RITUAL_RESPONSE=$(curl -s -X POST "$API_BASE/api/rituals" \
  -H "Content-Type: application/json" \
  -d "$RITUAL_DATA" \
  -H "user_id: $USER_ID")

RITUAL_ID=$(echo $RITUAL_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Ritual created: $RITUAL_ID"
echo ""

# 3. Join the ritual
echo "3️⃣ Joining ritual..."
curl -s -X POST "$API_BASE/api/rituals/$RITUAL_ID/join" \
  -H "Content-Type: application/json" \
  -H "user_id: $USER_ID" > /dev/null
echo "✅ Joined ritual"
echo ""

# 4. Check-in
echo "4️⃣ Checking in..."
curl -s -X POST "$API_BASE/api/attendance/checkin" \
  -H "Content-Type: application/json" \
  -d "{\"ritual_id\": \"$RITUAL_ID\", \"user_id\": \"$USER_ID\"}" > /dev/null
echo "✅ Checked in"
echo ""

# 5. Create feedback (need another user for P2P feedback)
echo "5️⃣ Creating feedback..."
# P2R feedback
curl -s -X POST "$API_BASE/api/feedback" \
  -H "Content-Type: application/json" \
  -d "{
    \"ritual_id\": \"$RITUAL_ID\",
    \"from_user_id\": \"$USER_ID\",
    \"feedback_type\": \"p2r\",
    \"p2r_feeling\": \"green\"
  }" > /dev/null
echo "✅ Feedback created"
echo ""

echo "🎉 Test data creation completed!"
echo "Note: You may need to create P2P feedback from another user for full RS calculation."
echo "Check RS history: curl $API_BASE/api/users/$USER_ID/rs-history"
