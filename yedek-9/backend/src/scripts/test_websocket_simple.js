import { io } from 'socket.io-client';

const WS_URL = 'http://localhost:3000';

console.log('🧪 WebSocket Test\n');
console.log('Connecting to:', WS_URL);
console.log('');

const socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
});

let testResults = {
  connected: false,
  pulseSubscribed: false,
  ritualSubscribed: false,
  pulseUpdateReceived: false,
  ritualUpdateReceived: false,
};

// Connection events
socket.on('connect', () => {
  console.log('✅ WebSocket connected!');
  console.log('   Socket ID:', socket.id);
  console.log('');
  testResults.connected = true;

  // Test 1: Subscribe to pulse
  console.log('📡 Subscribing to Pulse (Istanbul)...');
  socket.emit('pulse:subscribe', 'Istanbul');
  testResults.pulseSubscribed = true;
  console.log('   ✅ Subscribed');
  console.log('');

  // Test 2: Subscribe to a ritual (get from database)
  import('../config/database.js').then(async (module) => {
    const pool = module.default;
    try {
      const result = await pool.query('SELECT id FROM rituals LIMIT 1');
      if (result.rows.length > 0) {
        const ritualId = result.rows[0].id;
        console.log('📡 Subscribing to Ritual...');
        console.log('   Ritual ID:', ritualId);
        socket.emit('ritual:subscribe', ritualId);
        testResults.ritualSubscribed = true;
        console.log('   ✅ Subscribed');
        console.log('');
      } else {
        console.log('⚠️  No rituals found in database');
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  });
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
  console.log('📬 Pulse update received!');
  console.log('   City:', data.city);
  console.log('   Timestamp:', data.timestamp);
  console.log('');
  testResults.pulseUpdateReceived = true;
  printTestResults();
});

// Listen for ritual updates
socket.on('ritual:update', (data) => {
  console.log('📬 Ritual update received!');
  console.log('   Ritual ID:', data.ritualId);
  console.log('   Update Type:', data.updateType);
  console.log('   Data:', JSON.stringify(data.data, null, 2));
  console.log('');
  testResults.ritualUpdateReceived = true;
  printTestResults();
});

// Listen for ritual state
socket.on('ritual:state', (data) => {
  console.log('📬 Ritual state received!');
  console.log('   Ritual ID:', data.ritualId);
  console.log('   State:', JSON.stringify(data.state, null, 2));
  console.log('');
});

function printTestResults() {
  console.log('\n📊 Test Results:');
  console.log('   Connection:', testResults.connected ? '✅' : '❌');
  console.log('   Pulse Subscription:', testResults.pulseSubscribed ? '✅' : '❌');
  console.log('   Ritual Subscription:', testResults.ritualSubscribed ? '✅' : '❌');
  console.log('   Pulse Update Received:', testResults.pulseUpdateReceived ? '✅' : '⏳');
  console.log('   Ritual Update Received:', testResults.ritualUpdateReceived ? '✅' : '⏳');
  console.log('');
}

// Initial status after 3 seconds
setTimeout(() => {
  console.log('✅ WebSocket test setup completed!');
  console.log('   Waiting for events...');
  console.log('   To test:');
  console.log('   1. Create a new ritual (will trigger pulse:update)');
  console.log('   2. Join a ritual (will trigger ritual:update)');
  console.log('');
  printTestResults();
}, 3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  printTestResults();
  socket.disconnect();
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
