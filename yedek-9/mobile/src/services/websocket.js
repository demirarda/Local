import { io } from 'socket.io-client';
import { log, warn } from '../utils/logger';

// WebSocket base URL
// Prefer localhost so it works out of the box with iOS simulator on the same Mac.
// For physical devices, override with EXPO_PUBLIC_WS_URL in a .env file.
// Development: Use Mac's local IP for physical devices
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.pendingSubscriptions = {
      pulse: null,
      rituals: new Set(),
    };
  }

  connect() {
    if (this.socket && this.isConnected) {
      return;
    }

    // If socket exists but not connected, disconnect first
    if (this.socket) {
      this.socket.disconnect();
    }

    log('Connecting to WebSocket:', WS_URL);
    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
      reconnection: true,
      reconnectionDelay: 2000, // Increased delay
      reconnectionAttempts: 3, // Reduced attempts to fail faster
      timeout: 10000, // Reduced timeout to 10 seconds
      forceNew: true, // Force new connection
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      log('WebSocket connected');
      this.isConnected = true;
      this.emit('connection:established');
      
      // Resubscribe to pending subscriptions
      if (this.pendingSubscriptions.pulse) {
        log('Resubscribing to pulse:', this.pendingSubscriptions.pulse);
        this.socket.emit('pulse:subscribe', this.pendingSubscriptions.pulse);
      }
      
      this.pendingSubscriptions.rituals.forEach(ritualId => {
        log('Resubscribing to ritual:', ritualId);
        this.socket.emit('ritual:subscribe', ritualId);
      });
    });

    this.socket.on('disconnect', () => {
      log('WebSocket disconnected');
      this.isConnected = false;
      this.emit('connection:lost');
    });

    this.socket.on('connect_error', (error) => {
      // Log as warning instead of error to avoid red error screens
      warn('WebSocket connection error (non-fatal):', error.message || error);
      warn('WebSocket URL:', WS_URL);
      warn('Note: App will continue to work without WebSocket. Real-time updates will be disabled.');
      this.isConnected = false;
      // Don't emit error event to avoid breaking the app
      // this.emit('connection:error', error);
    });

    // Ritual updates
    this.socket.on('ritual:update', (data) => {
      this.emit('ritual:update', data);
    });

    this.socket.on('ritual:state', (data) => {
      this.emit('ritual:state', data);
    });

    // Pulse updates
    this.socket.on('pulse:update', (data) => {
      this.emit('pulse:update', data);
    });

    // Chat updates (used by Live Ritual and global bubble badge)
    this.socket.on('chat:message', (data) => {
      this.emit('chat:message', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Subscribe to ritual updates
  subscribeToRitual(ritualId) {
    this.pendingSubscriptions.rituals.add(ritualId);
    if (this.socket && this.isConnected) {
      log('Subscribing to ritual:', ritualId);
      this.socket.emit('ritual:subscribe', ritualId);
    } else {
      log('WebSocket not connected, will subscribe when connected');
    }
  }

  // Unsubscribe from ritual updates
  unsubscribeFromRitual(ritualId) {
    this.pendingSubscriptions.rituals.delete(ritualId);
    if (this.socket && this.isConnected) {
      this.socket.emit('ritual:unsubscribe', ritualId);
    }
  }

  // Subscribe to pulse updates for a city
  subscribeToPulse(city) {
    this.pendingSubscriptions.pulse = city;
    if (this.socket && this.isConnected) {
      log('Subscribing to pulse:', city);
      this.socket.emit('pulse:subscribe', city);
    } else {
      log('WebSocket not connected, will subscribe when connected');
    }
  }

  // Unsubscribe from pulse updates
  unsubscribeFromPulse(city) {
    this.pendingSubscriptions.pulse = null;
    if (this.socket && this.isConnected) {
      this.socket.emit('pulse:unsubscribe', city);
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;
