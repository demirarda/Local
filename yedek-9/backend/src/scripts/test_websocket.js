import { io } from 'socket.io-client';

const WS_URL = 'http://localhost:3000';

console.log('🧪 Testing WebSocket Connection...\n');

const socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
});

// Connection events
socket.on('connect', () => {
  console.log('✅ WebSocket connected!');
  console.log('   Socket ID:', socket.id);
  console.log('');

  // Test 1: Subscribe to pulse
  console.log('📡 Test 1: Subscribing to Pulse (Istanbul)...');
  socket.emit('pulse:subscribe', 'Istanbul');
  
  setTimeout(async () => {
    // Test 2: Subscribe to a ritual
    console.log('📡 Test 2: Subscribing to a ritual...');
    // Get a ritual ID from database
    try {
      const { default: pool } = await import('../config/database.js');
      const result = await pool.query('SELECT id FROM rituals LIMIT 1');
      if (result.rows.length > 0) {
        const ritualId = result.rows[0].id;
        console.log('   Ritual ID:', ritualId);
        socket.emit('ritual:subscribe', ritualId);
      } else {
        console.log('   No rituals found in database');
      }
    } catch (err) {
      console.error('   Error getting ritual:', err.message);
    }
  }, 1000);
});

socket.on('disconnect', () => {
  console.log('❌ WebSocket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

// Listen for pulse updates
socket.on('pulse:update', (data) => {
  console.log('📬 Pulse update received:');
  console.log('   City:', data.city);
  console.log('   Timestamp:', data.timestamp);
  console.log('');
});

// Listen for ritual updates
socket.on('ritual:update', (data) => {
  console.log('📬 Ritual update received:');
  console.log('   Ritual ID:', data.ritualId);
  console.log('   Update Type:', data.updateType);
  console.log('   Data:', JSON.stringify(data.data, null, 2));
  console.log('');
});

// Listen for ritual state
socket.on('ritual:state', (data) => {
  console.log('📬 Ritual state received:');
  console.log('   Ritual ID:', data.ritualId);
  console.log('   State:', JSON.stringify(data.state, null, 2));
  console.log('');
});

// Keep connection alive for testing
setTimeout(() => {
  console.log('\n✅ WebSocket test completed!');
  console.log('   Connection is working properly.');
  console.log('   Waiting for updates... (Press Ctrl+C to exit)');
}, 3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});
