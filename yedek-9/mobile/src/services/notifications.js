import * as Notifications from 'expo-notifications';
import useAuthStore from '../store/authStore';
import { getApiBaseUrl } from './api';
import { log, warn } from '../utils/logger';

const API_BASE_URL = getApiBaseUrl();

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 * @returns {Promise<boolean>} True if permissions granted
 */
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      warn('Notification permissions not granted');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get Expo push token
 * @returns {Promise<string|null>} Expo push token
 */
export async function getExpoPushToken() {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // Try to get push token
    // Note: In development with Expo Go, projectId may not be needed
    // If projectId is required, it should be set in app.json under extra.eas.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync();

    return tokenData.data;
  } catch (error) {
    // Silently fail for push tokens in development - not critical
    // This is normal for Expo Go or when projectId is not configured
    if (error.message?.includes('projectId')) {
      warn('Expo push token: projectId not found. Push notifications may not work in development. This is normal for Expo Go.');
      return null;
    }
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

/**
 * Register device token with backend
 * @param {string} userId - User ID
 * @param {string} token - Expo push token
 * @returns {Promise<boolean>} Success
 */
export async function registerDeviceToken(userId, token) {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    
    const response = await fetch(`${API_BASE_URL}/notifications/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        token: token,
        platform: platform,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error registering device token:', error);
    return false;
  }
}

/**
 * Unregister device token
 * @param {string} userId - User ID
 * @param {string} token - Expo push token
 * @returns {Promise<boolean>} Success
 */
export async function unregisterDeviceToken(userId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/unregister`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        token: token,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error unregistering device token:', error);
    return false;
  }
}

/**
 * Setup notification listeners
 * @param {Function} onNotificationReceived - Callback when notification received
 * @param {Function} onNotificationTapped - Callback when notification tapped
 * @returns {Array} Listener subscriptions (for cleanup)
 */
export function setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
  // Foreground notification handler
  const receivedListener = Notifications.addNotificationReceivedListener(notification => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Background/quit notification handler
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  return [receivedListener, responseListener];
}

/**
 * Initialize notifications for user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success
 */
export async function initializeNotifications(userId) {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    // Get push token
    const token = await getExpoPushToken();
    if (!token) {
      return false;
    }

    // Register with backend
    const registered = await registerDeviceToken(userId, token);
    if (!registered) {
      return false;
    }

    log('Notifications initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return false;
  }
}

/**
 * Fetch user notifications from backend
 * @param {string} userId - User ID
 * @param {number} limit - Limit
 * @param {boolean} unreadOnly - Only unread notifications
 * @returns {Promise<Array>} Notifications
 */
export async function fetchNotifications(userId, limit = 50, unreadOnly = false) {
  try {
    const url = `${API_BASE_URL}/notifications?limit=${limit}&unread_only=${unreadOnly}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success
 */
export async function markNotificationAsRead(notificationId, userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}
