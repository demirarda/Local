import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, warn } from '../utils/logger';

// Backend base URL
// Prefer EXPO_PUBLIC_API_BASE_URL when set (.env).
// For physical devices, set EXPO_PUBLIC_API_BASE_URL to your Mac's IP (e.g. http://192.168.1.XXX:3000/api).
// Defaults: iOS simulator → 127.0.0.1, Android emulator → 10.0.2.2 (host localhost)
export function getApiBaseUrl() {
  let url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (url) {
    if (Platform.OS === 'android' && url.includes('localhost')) {
      url = url.replace(/localhost/g, '10.0.2.2');
    } else if (Platform.OS === 'ios' && url.includes('localhost') && !url.includes('192.')) {
      url = url.replace(/localhost/g, '127.0.0.1');
    }
    return url;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://127.0.0.1:3000/api';
}
const API_BASE_URL = getApiBaseUrl();

// In-memory auth token used for authenticated requests.
// This is set from the auth store after login/initialize.
let authToken = null;
const PRESENCE_TICKETS_KEY = '@local_presence_tickets_v1';
let presenceTicketCache = null;

export function setAuthToken(token) {
  authToken = token || null;
}

async function loadPresenceTicketCache() {
  if (presenceTicketCache) return presenceTicketCache;
  try {
    const raw = await AsyncStorage.getItem(PRESENCE_TICKETS_KEY);
    presenceTicketCache = raw ? JSON.parse(raw) : {};
  } catch (_e) {
    presenceTicketCache = {};
  }
  return presenceTicketCache;
}

async function savePresenceTicket(ritualId, ticket) {
  if (!ritualId || !ticket?.token) return;
  const cache = await loadPresenceTicketCache();
  cache[String(ritualId)] = {
    token: String(ticket.token),
    expires_at: ticket.expires_at || null,
  };
  try {
    await AsyncStorage.setItem(PRESENCE_TICKETS_KEY, JSON.stringify(cache));
  } catch (_e) {
    // non-fatal
  }
}

async function getPresenceTicketHeader(ritualId) {
  const cache = await loadPresenceTicketCache();
  const item = cache[String(ritualId)];
  if (!item?.token) return {};
  if (item.expires_at && new Date(item.expires_at) <= new Date()) {
    delete cache[String(ritualId)];
    try {
      await AsyncStorage.setItem(PRESENCE_TICKETS_KEY, JSON.stringify(cache));
    } catch (_e) {}
    return {};
  }
  return { 'x-presence-ticket': item.token };
}

function buildJsonHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

// Timeout wrapper for fetch
function fetchWithTimeout(url, options = {}, timeout = 20000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
}

// Parse response as JSON; if server returns non-JSON (e.g. "Token expired", HTML), throw a clear error
async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text || !text.trim()) {
    if (response.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    }
    return {};
  }
  const trimmed = text.trim();
  const isJson = trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[';
  if (!isJson) {
    if (response.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    }
    throw new Error(`Server returned non-JSON (starts with "${trimmed.slice(0, 30)}..."). Check API URL and response.`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    if (response.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    }
    throw new Error(`Invalid JSON from server: ${trimmed.slice(0, 80)}${trimmed.length > 80 ? '...' : ''}`);
  }
}

// Retry mechanism for rate limiting (429 errors)
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;
  let lastResponse;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, 20000); // 20 second timeout
      lastResponse = response;
      
      // If 429 (Too Many Requests), wait and retry
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          // In development, cap wait time to prevent long delays
          // Use shorter waits: 2s, 4s max
          const baseWait = retryAfter
            ? Math.min(parseInt(retryAfter, 10) * 1000, 4000) // Cap Retry-After at 4s
            : 2000 * (attempt + 1); // 2s, 4s
          const waitTime = Math.min(baseWait, 4000); // Cap at 4s max
          
          log(`Rate limited (429). Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          // Last attempt failed with 429, return the response anyway
          // Let the caller handle it
          return response;
        }
      }
      
      // Success or other status codes
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 3000);
        log(`Request failed. Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If we have a response (even if 429), return it
  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('Request failed after retries');
}

export async function fetchPulseRituals(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.city) queryParams.append('city', params.city);
  if (params.lat) queryParams.append('lat', params.lat);
  if (params.lng) queryParams.append('lng', params.lng);
  if (params.radius) queryParams.append('radius', params.radius);
  if (params.viewerId) queryParams.append('viewer_id', params.viewerId);

  const url = `${API_BASE_URL}/rituals/pulse?${queryParams.toString()}`;
  log('fetchPulseRituals - URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });

    if (!response.ok) {
      // On 4xx/5xx, log and fall back to empty data instead of throwing
      log('fetchPulseRituals non-OK response:', response.status);
      return {
        live_now: [],
        starting_soon: [],
        almost_full: [],
        reopened: [],
      };
    }
    const data = await response.json();
    log('fetchPulseRituals - Response received:', { success: data.success, hasData: !!data.data });
    return data.data || {
      live_now: [],
      starting_soon: [],
      almost_full: [],
      reopened: [],
    };
  } catch (error) {
    warn('Error fetching pulse rituals (non-fatal):', error?.message || error);
    // Fallback to empty sections so UI can render without crashing
    return {
      live_now: [],
      starting_soon: [],
      almost_full: [],
      reopened: [],
    };
  }
}

export async function fetchPulseFeed(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.city) queryParams.append('city', params.city);
  if (params.viewerId) queryParams.append('viewer_id', params.viewerId);
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.cursor) queryParams.append('cursor', params.cursor);

  const url = `${API_BASE_URL}/rituals/feed?${queryParams.toString()}`;
  log('fetchPulseFeed - URL:', url);

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      log('fetchPulseFeed non-OK response:', response.status);
      return {
        items: [],
        rituals: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
        ritual_pool: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
        memories: [],
        next_cursor: null,
        has_more: false,
      };
    }
    const data = await response.json();
    return data.data || {
      items: [],
      rituals: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
      ritual_pool: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
      memories: [],
      next_cursor: null,
      has_more: false,
    };
  } catch (error) {
    warn('Error fetching pulse feed (non-fatal):', error?.message || error);
    return {
      items: [],
      rituals: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
      ritual_pool: { live_now: [], starting_soon: [], almost_full: [], reopened: [] },
      memories: [],
      next_cursor: null,
      has_more: false,
    };
  }
}

export async function fetchRitualDetail(ritualId, viewerId = null) {
  let url = `${API_BASE_URL}/rituals/${ritualId}`;
  if (viewerId) {
    url += `?viewer_id=${viewerId}`;
  }
  
  try {
    log('Fetching ritual detail from:', url);
    
    // Increased timeout for better reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      warn('Fetch timeout after 30 seconds');
    }, 30000); // 30 second timeout - more reasonable for network requests
    
    const response = await fetchWithRetry(url, {
      signal: controller.signal,
      method: 'GET',
      headers: buildJsonHeaders(),
    }).catch(fetchError => {
      clearTimeout(timeoutId);
      warn('Fetch error (network):', fetchError?.message || fetchError);
      throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server'}`);
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // 404 can happen when stale/deleted ritual cards are opened.
      // Treat it as a non-fatal "not found" case so UI can recover gracefully.
      if (response.status === 404) {
        warn('Ritual detail not found (non-fatal):', ritualId, errorText);
        return null;
      }
      warn('Ritual detail API returned non-OK:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json().catch(jsonError => {
      warn('JSON parse error:', jsonError?.message || jsonError);
      throw new Error('Invalid response from server');
    });
    
    log('API response:', data.success ? 'Success' : 'Failed');
    
    if (!data.success) {
      if (String(data.error || '').toLowerCase().includes('not found')) {
        warn('Ritual detail payload indicates not found (non-fatal):', ritualId);
        return null;
      }
      throw new Error(data.error || 'Failed to fetch ritual detail');
    }
    
    if (!data.data) {
      throw new Error('Ritual data not found');
    }
    
    return data.data;
  } catch (error) {
    warn('Error fetching ritual detail:', error?.message || error);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection and try again.');
    }
    // Re-throw with more context
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to fetch ritual: ${error.message || 'Unknown error'}`);
  }
}

/** Outer-layer preview for unauthenticated viewers (son-part.md §2.2) */
export async function fetchPublicRitualDetail(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/public`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch ritual preview');
    }
    return data.data;
  } catch (error) {
    warn('Error fetching public ritual detail:', error?.message || error);
    throw error;
  }
}

export async function fetchRitualSeries(seriesId) {
  const url = `${API_BASE_URL}/series/${seriesId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Seri yüklenemedi');
  return data.data;
}

export async function fetchSeriesDetail(seriesId) {
  return fetchRitualSeries(seriesId);
}

export async function searchPeople(q) {
  const url = `${API_BASE_URL}/search?q=${encodeURIComponent(q)}&tab=people`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Search failed');
  const payload = data.data || data;
  return payload.people || payload.results || payload.items || [];
}

/**
 * F1.5 Friends-DM / waitlist hatası — 410 gate'i ayırt edebilmek için
 * code + status alanlarını taşır.
 */
function buildF15Error(response, data, fallback) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code;
  error.status = response.status;
  error.featureDisabled = response.status === 410;
  return error;
}

/** GET /api/friends-dm/threads — konuşma listesi (inbox) */
export async function fetchDmThreads() {
  const url = `${API_BASE_URL}/friends-dm/threads`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'DM inbox failed');
  return data.data || [];
}

/** POST /api/friends-dm/threads — arkadaşla thread aç (idempotent) */
export async function openDmThread(friendId) {
  const url = `${API_BASE_URL}/friends-dm/threads`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ friend_id: friendId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Open DM failed');
  return data.data;
}

/** GET /api/friends-dm/threads/:id/messages — eskiden yeniye sıralı */
export async function fetchDmMessages(threadId, { limit = 50, before = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  const url = `${API_BASE_URL}/friends-dm/threads/${threadId}/messages?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'DM messages failed');
  return data.data || [];
}

/** POST /api/friends-dm/threads/:id/messages */
export async function sendDmMessage(threadId, body) {
  const url = `${API_BASE_URL}/friends-dm/threads/${threadId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Send DM failed');
  return data.data;
}

/** POST /api/friends-dm/threads/:id/read — okundu işaretle */
export async function markDmThreadRead(threadId) {
  const url = `${API_BASE_URL}/friends-dm/threads/${threadId}/read`;
  const response = await fetch(url, { method: 'POST', headers: buildJsonHeaders() });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.data || null;
}

/** POST /api/later/waitlist — masa doluyken yıldız listesine gir */
export async function joinRitualWaitlist(ritualId) {
  const url = `${API_BASE_URL}/later/waitlist`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ ritual_id: ritualId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Waitlist join failed');
  return data.data;
}

/** DELETE /api/later/waitlist/:ritualId — sıradan çık */
export async function leaveRitualWaitlist(ritualId) {
  const url = `${API_BASE_URL}/later/waitlist/${ritualId}`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Waitlist leave failed');
  return data.data;
}

/** GET /api/later/waitlist/:ritualId — bu masadaki sıra durumum */
export async function fetchRitualWaitlistStatus(ritualId) {
  const url = `${API_BASE_URL}/later/waitlist/${ritualId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Waitlist status failed');
  return data.data;
}

/** GET /api/later/waitlist — beklediğim tüm masalar */
export async function fetchMyWaitlistEntries() {
  const url = `${API_BASE_URL}/later/waitlist`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildF15Error(response, data, 'Waitlist list failed');
  return data.data || [];
}

export async function updateRitualSeriesSchedule(seriesId, { cadence, endAfterWeeks } = {}) {
  const url = `${API_BASE_URL}/series/${seriesId}`;
  const body = {};
  if (cadence !== undefined) body.cadence = cadence;
  if (endAfterWeeks !== undefined) body.end_after_weeks = endAfterWeeks;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Seri güncellenemedi');
  return data.data;
}

export async function followRitualSeries(seriesId, bell = true) {
  const url = `${API_BASE_URL}/series/${seriesId}/follow`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ bell }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Series follow failed');
  }
  return (await response.json()).data;
}

export async function unfollowRitualSeries(seriesId) {
  const url = `${API_BASE_URL}/series/${seriesId}/follow`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Series unfollow failed');
  }
  return (await response.json()).data;
}

export async function cancelRitualSeries(seriesId) {
  const url = `${API_BASE_URL}/series/${seriesId}/cancel`;
  const response = await fetch(url, { method: 'POST', headers: buildJsonHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Series cancel failed');
  }
  return (await response.json()).data;
}

export async function transferRitualSeries(seriesId, newHostId) {
  const url = `${API_BASE_URL}/series/${seriesId}/transfer`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ new_host_id: newHostId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Series transfer failed');
  }
  return (await response.json()).data;
}

export async function joinRitual(ritualId, userId, inviteToken = null) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/join`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ user_id: userId, invite_token: inviteToken }),
    });

    // Parse JSON body once so we can inspect structured error fields
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Failed to join ritual');
      if (data.requires_invite) {
        error.requires_invite = true;
      }
      if (data.code) error.code = data.code;
      if (data.until) error.until = data.until;
      throw error;
    }

    return {
      ...(data.data || {}),
      blocked_peer_warning: Boolean(data.blocked_peer_warning),
      rejoin: Boolean(data.rejoin),
    };
  } catch (error) {
    // Don't log "Already joined" as an error - it's a valid state
    if (!error.message || !error.message.includes('Already joined')) {
      console.error('Error joining ritual:', error);
    }
    throw error;
  }
}

export async function createRitualInvite(ritualId, inviterId, inviteeId = null, expiresAt = null) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/invites`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        inviter_id: inviterId,
        invitee_id: inviteeId,
        expires_at: expiresAt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Failed to create invite');
      throw error;
    }

    return data.data; // { id, token, created_at, expires_at }
  } catch (error) {
    console.error('Error creating ritual invite:', error);
    throw error;
  }
}

export async function createRitual(ritualData) {
  const url = `${API_BASE_URL}/rituals`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(ritualData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const error = new Error(errorData.error || 'Failed to create ritual');
      if (errorData.requires_attendance) {
        error.requires_attendance = true;
      }
      if (errorData.code) error.code = errorData.code;
      if (errorData.until) error.until = errorData.until;
      throw error;
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error creating ritual:', error);
    throw error;
  }
}

export async function publishRitual(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/publish`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      const error = new Error(errorData.error || 'Failed to publish ritual');
      if (errorData.code) error.code = errorData.code;
      if (errorData.until) error.until = errorData.until;
      throw error;
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error publishing ritual:', error);
    throw error;
  }
}

export async function submitFeedback(feedbackData) {
  const url = `${API_BASE_URL}/feedback`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(feedbackData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

export async function submitBatchFeedback(ritualId, fromUserId, feedbacks) {
  const url = `${API_BASE_URL}/feedback/batch`;
  log('submitBatchFeedback - URL:', url);

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        ritual_id: ritualId,
        from_user_id: fromUserId,
        feedbacks: feedbacks,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    warn('Error submitting batch feedback (non-fatal):', error.message || error);
    throw error;
  }
}

export async function fetchFeedbackWindow(ritualId) {
  const url = `${API_BASE_URL}/feedback/window/${ritualId}`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Feedback window unavailable');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    warn('fetchFeedbackWindow failed:', error?.message || error);
    throw error;
  }
}

export async function fetchUserProfile(userId) {
  const url = `${API_BASE_URL}/users/${userId}`;
  log('fetchUserProfile - URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

export async function fetchHostLedger(userId) {
  const url = `${API_BASE_URL}/users/${userId}/host-ledger`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Host ledger failed');
  }
  return data.data;
}

export async function fetchVenueMarketShare(venueId, params = {}) {
  const q = params.month ? `?month=${encodeURIComponent(params.month)}` : '';
  const url = `${API_BASE_URL}/venues/${venueId}/market-share${q}`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok || !data.success) {
    const err = new Error(data.error || 'Market share failed');
    err.status = response.status;
    throw err;
  }
  return data.data;
}

export async function checkIn(ritualId, userId, options = {}) {
  const url = `${API_BASE_URL}/attendance/checkin`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        ritual_id: ritualId,
        user_id: userId,
        latitude: options.latitude,
        longitude: options.longitude,
        checkin_code: options.checkin_code || options.checkin_keyword || options.host_keyword || null,
        nfc_marker: Boolean(options.nfc_marker),
        nfc_tag_id: options.nfc_tag_id || null,
        open_note: options.open_note || null,
        location_suspect: Boolean(options.location_suspect),
        mock_location: Boolean(options.mock_location),
        play_integrity: options.play_integrity === false ? false : undefined,
        app_attest: options.app_attest === false ? false : undefined,
        root: options.root === true ? true : undefined,
        digital_paste: Boolean(options.digital_paste),
        local_tag_redeem: Boolean(options.local_tag_redeem),
        entry_ms: options.entry_ms != null ? Number(options.entry_ms) : undefined,
        gate_ms: options.gate_ms != null ? Number(options.gate_ms) : undefined,
        culture_path: options.culture_path || undefined,
      }),
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || 'Failed to check in');
      err.status = response.status;
      err.body = data;
      throw err;
    }
    const ticket = data?.presence_ticket || data?.data?.presence_ticket || null;
    if (ticket?.token) {
      await savePresenceTicket(ritualId, ticket);
    }
    return data;
  } catch (error) {
    console.error('Error checking in:', error);
    throw error;
  }
}

/** C1: kapı hunisi — door_view / door_abandon (join sunucuda yazılır) */
export async function recordCheckinFunnelClient(ritualId, event, meta = {}) {
  if (!ritualId || !event) return { recorded: false };
  try {
    const url = `${API_BASE_URL}/rituals/${ritualId}/checkin-funnel`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ event, meta }),
    });
    const json = await response.json().catch(() => ({}));
    return json.data || { recorded: response.ok };
  } catch (_e) {
    return { recorded: false };
  }
}

export async function revealRitualKeyword(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/reveal-keyword`;
  const presenceHeader = await getPresenceTicketHeader(ritualId);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(presenceHeader),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to reveal keyword');
  }
  return response.json();
}

export async function createLocalCheckinTag(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/checkin/local-tag`;
  const presenceHeader = await getPresenceTicketHeader(ritualId);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(presenceHeader),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(json.error || 'LOCAL-TAG olusturulamadi');
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json.data || json;
}

export async function redeemLocalCheckinTag(ritualId, token, { latitude, longitude } = {}) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/checkin/redeem-tag`;
  const presenceHeader = await getPresenceTicketHeader(ritualId);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(presenceHeader),
    body: JSON.stringify({
      token,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(json.error || 'LOCAL-TAG gecersiz');
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json.data || json;
}

/** PENDING_WITNESS — mühürlü peer tek-tık onayı */
export async function witnessPendingCheckin(ritualId, subjectUserId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/checkin/witness`;
  const presenceHeader = await getPresenceTicketHeader(ritualId);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(presenceHeader),
    body: JSON.stringify({ subject_user_id: subjectUserId }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(json.error || 'Tanik onayi basarisiz');
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json.data || json;
}

/** VEN-EVENT: venue staff opens check-in code */
export async function revealVenueRitualKeyword(venueId, ritualId) {
  const url = `${API_BASE_URL}/venues/${venueId}/rituals/${ritualId}/reveal-keyword`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to reveal venue ritual keyword');
  }
  return response.json();
}

export async function fetchVenueRituals(venueId, { status, limit = 50 } = {}) {
  const q = new URLSearchParams();
  if (status) q.append('status', status);
  q.append('limit', String(limit));
  const url = `${API_BASE_URL}/venues/${venueId}/rituals?${q.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch venue rituals');
  }
  const json = await response.json();
  return json.data || [];
}

export async function startIdentityVerification(payload = {}) {
  const response = await fetch(`${API_BASE_URL}/identity/start`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      document_type: payload.document_type || payload.documentType || 'TCKK',
      track: payload.track || 'identity',
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error || 'Identity verification could not start');
    err.code = error.code || error.error;
    throw err;
  }
  return response.json();
}

export async function completeIdentityVerification(payload = {}) {
  const response = await fetch(`${API_BASE_URL}/identity/complete`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      verification_id: payload.verification_id || payload.verificationId,
      nfc_payload: payload.nfc_payload || payload.nfcPayload || null,
      liveness_ok: payload.liveness_ok !== false && payload.livenessOk !== false,
      face_match_ok: payload.face_match_ok !== false && payload.faceMatchOk !== false,
      age_years: payload.age_years ?? payload.ageYears ?? 18,
      path: payload.path || 'nfc',
      document_number_hint: payload.document_number_hint || payload.documentNumberHint || null,
      // Never send local image URIs — verify-and-discard
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error || error.code || 'Identity verification could not complete');
    err.code = error.code || error.error;
    throw err;
  }
  return response.json();
}

export async function getIdentityVerificationStatus() {
  const response = await fetch(`${API_BASE_URL}/identity/status`, {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Identity verification status unavailable');
  }
  return response.json();
}

export async function getIdentityCultureLines(lang = 'tr') {
  const response = await fetch(`${API_BASE_URL}/identity/culture-lines?lang=${encodeURIComponent(lang)}`, {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Culture lines unavailable');
  }
  const json = await response.json();
  return json.data || json;
}

export async function getUniversityProfile(name) {
  const response = await fetch(
    `${API_BASE_URL}/identity/university-profile?name=${encodeURIComponent(name || '')}`,
    {
      method: 'GET',
      headers: buildJsonHeaders(),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'University profile unavailable');
  }
  const json = await response.json();
  return json.data || json;
}

export async function updateUniversityProfile(payload = {}) {
  const response = await fetch(`${API_BASE_URL}/identity/university-profile`, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'University profile update failed');
  }
  const json = await response.json();
  return json.data || json;
}

export async function createUniversityOfficialEvent(payload = {}) {
  const response = await fetch(`${API_BASE_URL}/identity/university-profile/events`, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Official event create failed');
  }
  const json = await response.json();
  return json.data || json;
}

export async function claimRitualEscrow(_ritualId, _payload = {}) {
  // Escrow removed (firstSeal) — never call dead endpoint
  return {
    success: false,
    error: 'Escrow removed — use first seal at table',
    code: 'ESCROW_REMOVED',
  };
}

export async function leaveRitual(ritualId, userId) {
  const url = `${API_BASE_URL}/attendance/leave`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        ritual_id: ritualId,
        user_id: userId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave ritual');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error leaving ritual:', error);
    throw error;
  }
}

export async function cancelAttendance(ritualId, { forceWithoutReplacement = false } = {}) {
  const url = `${API_BASE_URL}/attendance/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      ritual_id: ritualId,
      force_without_replacement: !!forceWithoutReplacement,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Failed to cancel attendance');
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function claimReplacementSlot(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/replacement/claim`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to claim replacement slot');
  }
  return data;
}

export async function manualApproveCheckIn(ritualId, participantUserId) {
  const url = `${API_BASE_URL}/attendance/${ritualId}/manual-approve`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ user_id: participantUserId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to approve manual check-in');
  }
  return data;
}

export async function fetchDsDashboard() {
  const url = `${API_BASE_URL}/users/me/ds-dashboard`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch DS dashboard');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function acceptFriendRequest(friendshipId) {
  const url = `${API_BASE_URL}/friends/${friendshipId}/accept`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to accept friend request');
  }
  return data;
}

export async function declineFriendRequest(friendshipId) {
  const url = `${API_BASE_URL}/friends/${friendshipId}/decline`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to decline friend request');
  }
  return data;
}

export function buildQrBumpPayload(userId) {
  return `LOCAL:USER:${userId}`;
}

export async function qrBumpFriend({ qrPayload, targetUserId } = {}) {
  const url = `${API_BASE_URL}/friends/bump`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      qr_payload: qrPayload || null,
      target_user_id: targetUserId || null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'QR bump failed');
  }
  return data;
}

// City Rhythm API
export async function browseRituals(params = {}) {
  const queryParams = new URLSearchParams();
  log('browseRituals params:', params);
  if (params.city) queryParams.append('city', params.city);
  if (params.search) queryParams.append('search', params.search);
  if (params.type) queryParams.append('type', params.type);
  if (params.status) queryParams.append('status', params.status);
  if (params.entry_type) queryParams.append('entry_type', params.entry_type);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.lat) queryParams.append('lat', params.lat);
  if (params.lng) queryParams.append('lng', params.lng);
  if (params.radius) queryParams.append('radius', params.radius);
  if (params.feed_scope) queryParams.append('feed_scope', params.feed_scope);
  if (params.viewer_id) queryParams.append('viewer_id', params.viewer_id);

  const url = `${API_BASE_URL}/city-rhythm/browse?${queryParams.toString()}`;
  log('browseRituals URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      log('browseRituals non-OK response:', response.status);
      return { data: [], pagination: { page: 1, totalPages: 1 } };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    log('Error browsing rituals (non-fatal):', error?.message || error);
    return { data: [], pagination: { page: 1, totalPages: 1 } };
  }
}

export async function fetchCategories() {
  const url = `${API_BASE_URL}/city-rhythm/categories`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      log('fetchCategories non-OK response:', response.status);
      return [];
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    log('Error fetching categories (non-fatal):', error?.message || error);
    return [];
  }
}

// Friends API
export async function fetchFriends(userId, status = 'accepted') {
  const url = `${API_BASE_URL}/friends?user_id=${userId}&status=${status}`;
  log('fetchFriends - URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const err = new Error(body.error || `HTTP error! status: ${response.status}`);
      err.code = body.code || (response.status === 403 ? 'FRIENDS_LIST_PRIVATE' : undefined);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching friends:', error);
    throw error;
  }
}

export async function fetchFriendPulseEvents(viewerId, limit = 5) {
  const url = `${API_BASE_URL}/friends/pulse-events?viewer_id=${viewerId}&limit=${limit}`;
  log('fetchFriendPulseEvents - URL:', url);

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });

    if (!response.ok) {
      log('fetchFriendPulseEvents non-OK response:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    log('Error fetching friend pulse events (non-fatal):', error?.message || error);
    return [];
  }
}

// Follow API
export async function followUser(followerId, followingId, bell = false) {
  const url = `${API_BASE_URL}/follows`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        follower_id: followerId,
        following_id: followingId,
        bell: bell === true,
      }),
    });
    
    const data = await response.json().catch(() => ({}));
    if (response.status === 202 || data.mode === 'request') {
      return { mode: 'request', data: data.data, message: data.message };
    }
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || 'Failed to follow user');
    }
    
    return { mode: 'follow', data: data.data };
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
}

export async function setUserFollowBell(followingId, bell) {
  const url = `${API_BASE_URL}/follows/${followingId}/bell`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ bell: bell === true }),
  });
  if (!response.ok) throw new Error(`Bell update failed (${response.status})`);
  const data = await response.json();
  return data.data;
}

export async function unfollowUser(followerId, followingId) {
  const url = `${API_BASE_URL}/follows/${followingId}?follower_id=${followerId}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unfollow user');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
}

export async function checkFollowStatus(followerId, followingId) {
  const url = `${API_BASE_URL}/follows/check?follower_id=${followerId}&following_id=${followingId}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { is_following: false, bell: false };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return {
      is_following: Boolean(data.data?.is_following),
      bell: Boolean(data.data?.bell),
    };
  } catch (error) {
    warn('Error checking follow status (non-fatal):', error?.message || error);
    return { is_following: false, bell: false };
  }
}

export async function getFollows(userId, type = 'following') {
  const url = `${API_BASE_URL}/follows?user_id=${userId}&type=${type}`;
  log('getFollows - URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching follows:', error);
    throw error;
  }
}

// Venues API
export async function getVenues(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.city) queryParams.append('city', params.city);
  if (params.search) queryParams.append('search', params.search);
  if (params.limit != null) queryParams.append('limit', params.limit);
  if (params.offset != null) queryParams.append('offset', params.offset);
  const url = `${API_BASE_URL}/venues?${queryParams.toString()}`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching venues:', error);
    throw error;
  }
}

export async function getManagedVenues() {
  const url = `${API_BASE_URL}/venues/managed`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching managed venues:', error);
    throw error;
  }
}

export async function fetchMyVenueApplication() {
  const url = `${API_BASE_URL}/venues/applications/me`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch venue application');
  const data = await response.json();
  return { application: data.data, onboarding_steps: data.onboarding_steps || [] };
}

export async function submitVenueApplication(payload) {
  const url = `${API_BASE_URL}/venues/applications`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to submit venue application');
  }
  const data = await response.json();
  return data.data;
}

export async function withdrawVenueApplication() {
  const url = `${API_BASE_URL}/venues/applications/me/withdraw`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to withdraw application');
  }
  const data = await response.json();
  return data.data;
}

export async function updateVenueVitrine(venueId, payload) {
  const url = `${API_BASE_URL}/venues/${venueId}/vitrine`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update vitrine');
  }
  return response.json();
}

export async function publishVenueVitrine(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/vitrine/publish`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to publish vitrine');
  }
  return response.json();
}

export async function fetchVenueFloorPlan(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/floor-plan`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch floor plan');
  }
  const data = await response.json();
  return data.data || {};
}

export async function updateVenueFloorPlan(venueId, payload) {
  const url = `${API_BASE_URL}/venues/${venueId}/floor-plan`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update floor plan');
  }
  const data = await response.json();
  return data.data || {};
}

export async function verifyVenueGps(venueId, { lat, lng }) {
  const url = `${API_BASE_URL}/venues/${venueId}/gps-verify`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ lat, lng }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'GPS verification failed');
  }
  const data = await response.json();
  return data.data || {};
}

export async function fetchVenueSlots(venueId, { status = 'open' } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const url = `${API_BASE_URL}/venues/${venueId}/slots?${params.toString()}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue slots');
  }
  const data = await response.json();
  return data.data || [];
}

export async function createVenueSlot(venueId, payload) {
  const url = `${API_BASE_URL}/venues/${venueId}/slots`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create venue slot');
  }
  const data = await response.json();
  return data.data;
}

export async function setVenueSlotBrandPriority(venueId, slotId, enabled = true) {
  const url = `${API_BASE_URL}/venues/${venueId}/slots/${slotId}/brand-priority`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ enabled: Boolean(enabled) }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to set brand priority');
  }
  const data = await response.json();
  return data.data;
}

export async function claimVenueSlot(venueId, slotId) {
  const url = `${API_BASE_URL}/venues/${venueId}/slots/${slotId}/claim`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to claim venue slot');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueSuggestionInbox(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/suggestions/inbox`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch suggestion inbox');
  }
  const data = await response.json();
  const list = data.data || [];
  return {
    suggestions: Array.isArray(list) ? list : [],
    unanswered_count: Number(data.unanswered_count ?? list?.unanswered_count ?? 0),
  };
}

export async function fetchVenueSuggestionHistory(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/suggestions/history`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch suggestion history');
  }
  const data = await response.json();
  return data.data || [];
}

export async function submitVenueSlotSuggestion(venueId, payload) {
  const url = `${API_BASE_URL}/venues/${venueId}/suggestions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to submit suggestion');
  }
  const data = await response.json();
  return data.data;
}

export async function approveVenueSlotSuggestion(venueId, suggestionId, reviewerNote = '') {
  const url = `${API_BASE_URL}/venues/${venueId}/suggestions/${suggestionId}/approve`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ reviewer_note: reviewerNote || undefined }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to approve suggestion');
  }
  const data = await response.json();
  return data.data;
}

export async function rejectVenueSlotSuggestion(venueId, suggestionId, reviewerNote = '') {
  const url = `${API_BASE_URL}/venues/${venueId}/suggestions/${suggestionId}/reject`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ reviewer_note: reviewerNote || undefined }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to reject suggestion');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueArchive(venueId, { limit = 30, offset = 0, featuredOnly = false } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (featuredOnly) params.set('featured', '1');
  const url = `${API_BASE_URL}/venues/${venueId}/archive?${params.toString()}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue archive');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueSlotConfig(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/slots/config`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch slot config');
  }
  const data = await response.json();
  return data.data;
}

export async function requestVenuePackageUpgrade(venueId, tierId, note = '') {
  const url = `${API_BASE_URL}/venues/${venueId}/business/upgrade-request`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ tier_id: tierId, note }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit upgrade request');
  }
  const data = await response.json();
  return data.data;
}

export async function createVenuePackageCheckout(venueId, tierId, note = '') {
  const url = `${API_BASE_URL}/venues/${venueId}/business/checkout`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ tier_id: tierId, note }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start checkout');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenuePackageRequests(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/business/package-requests`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch package requests');
  }
  const data = await response.json();
  return data.data;
}

export async function requestVenueAddonSlot(venueId, qty = 1) {
  const url = `${API_BASE_URL}/venues/${venueId}/business/addon-slot`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ qty }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add slot');
  }
  const data = await response.json();
  return data.data;
}

export async function requestVenueTakeover(venueId, { dayType = 'weekday', included = false } = {}) {
  const url = `${API_BASE_URL}/venues/${venueId}/business/takeover`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ day_type: dayType, included }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start takeover');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueVenEventQuota(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/ven-event-quota`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch VEN-EVENT quota');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueNightReport(venueId, { date, mini } = {}) {
  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  if (mini) qs.set('mini', '1');
  const url = `${API_BASE_URL}/venues/${venueId}/night-report${qs.toString() ? `?${qs}` : ''}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch night report');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueMonthlyPulse(venueId, month) {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  const url = `${API_BASE_URL}/venues/${venueId}/monthly-pulse${qs}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch monthly pulse');
  }
  const data = await response.json();
  return data.data;
}

export async function nominateVenuePlace(payload) {
  const url = `${API_BASE_URL}/nominations`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to nominate venue');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueShadowPitch(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/shadow-pitch`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch shadow pitch');
  }
  const data = await response.json();
  return data.data;
}

export async function setVenueFeaturedEvent(venueId, card) {
  const url = `${API_BASE_URL}/venues/${venueId}/business/featured-event`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ card }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to set featured event');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueChipTrends(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/chip-trends`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch chip trends');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueAiAdvice(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/ai-advice`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch AI advice');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchVenueBusiness(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/business`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue business');
  }
  const data = await response.json();
  return data.data;
}

export async function updateVenueBusinessNotes(venueId, managerNotes = '') {
  const url = `${API_BASE_URL}/venues/${venueId}/business`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ manager_notes: managerNotes }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update venue business');
  }
  const data = await response.json();
  return data.data;
}

/** C5: totem ok|broken|missing */
export async function updateVenueTotemStatus(venueId, totemStatus) {
  const url = `${API_BASE_URL}/venues/${venueId}/totem-status`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ totem_status: totemStatus }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Totem durumu guncellenemedi');
  }
  return json.data || json;
}

/** C5: totem talebi (kayıp → white-glove kuyruk) */
export async function requestVenueTotem(venueId, note = null) {
  const url = `${API_BASE_URL}/venues/${venueId}/totem-request`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ note: note || null }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Totem talebi gonderilemedi');
  }
  return json.data || json;
}

export async function fetchMyRegularStatus(venueId = null) {
  const q = venueId ? `?venue_id=${encodeURIComponent(venueId)}` : '';
  const url = `${API_BASE_URL}/users/me/regular${q}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch regular status');
  const data = await response.json();
  return data.data;
}

export async function fetchMyRegulars() {
  const url = `${API_BASE_URL}/users/me/regulars`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch regulars');
  const data = await response.json();
  return data.data || [];
}

export async function fetchVenueRegulars(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/regulars`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue regulars');
  }
  const data = await response.json();
  return data.data || [];
}

export async function setVenueFeaturedMemories(venueId, featuredMemoryIds = []) {
  const url = `${API_BASE_URL}/venues/${venueId}/archive/featured`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ featured_memory_ids: featuredMemoryIds }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update featured memories');
  }
  const data = await response.json();
  return data.data;
}

export async function getVenue(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching venue:', error);
    throw error;
  }
}

export async function patchVenue(venueId, payload = {}) {
  const url = `${API_BASE_URL}/venues/${venueId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Venue guncellenemedi');
  }
  return json.data || json;
}

/** §12 Arama & keşif */
export async function searchDiscovery({ q = '', tab = 'all', limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tab) params.set('tab', tab);
  if (limit) params.set('limit', String(limit));
  const url = `${API_BASE_URL}/search?${params.toString()}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const data = await response.json();
  return data.data || { results: [], tabs: [] };
}

export async function fetchVenueCharacterCard(venueId) {
  const url = `${API_BASE_URL}/search/venues/${venueId}/character-card`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error(`Character card failed (${response.status})`);
  const data = await response.json();
  return data.data || null;
}

export async function fetchChainProfile(chainId) {
  const url = `${API_BASE_URL}/search/chains/${chainId}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error(`Chain profile failed (${response.status})`);
  const data = await response.json();
  return data.data || null;
}

export async function fetchBrandProfile(brandId) {
  const url = `${API_BASE_URL}/search/brands/${brandId}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error(`Brand profile failed (${response.status})`);
  const data = await response.json();
  return data.data || null;
}

// Venue follows API (auth required)
export async function getVenueFollows() {
  const url = `${API_BASE_URL}/venue-follows`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching venue follows:', error);
    throw error;
  }
}

export async function followVenue(venueId, bell = false) {
  const url = `${API_BASE_URL}/venue-follows`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ venue_id: venueId, bell: bell === true }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to follow venue');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error following venue:', error);
    throw error;
  }
}

export async function setVenueFollowBell(venueId, bell) {
  const url = `${API_BASE_URL}/venue-follows/${venueId}/bell`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ bell: bell === true }),
  });
  if (!response.ok) throw new Error(`Bell update failed (${response.status})`);
  const data = await response.json();
  return data.data;
}

export async function getVenueFollowStatus(venueId) {
  const url = `${API_BASE_URL}/venue-follows/${venueId}/status`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return { is_following: false, bell: false };
  const data = await response.json();
  return data.data || { is_following: false, bell: false };
}

export async function unfollowVenue(venueId) {
  const url = `${API_BASE_URL}/venue-follows/${venueId}`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to unfollow venue');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error unfollowing venue:', error);
    throw error;
  }
}

export async function followZone(zoneId, bell = false) {
  const url = `${API_BASE_URL}/zones/${zoneId}/follow`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ bell: bell === true }),
  });
  if (!response.ok) throw new Error(`Zone follow failed (${response.status})`);
  const data = await response.json();
  return data.data;
}

export async function unfollowZone(zoneId) {
  const url = `${API_BASE_URL}/zones/${zoneId}/follow`;
  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: buildJsonHeaders(),
  });
  if (!response.ok) throw new Error(`Zone unfollow failed (${response.status})`);
  return true;
}

export async function setZoneFollowBell(zoneId, bell) {
  const url = `${API_BASE_URL}/zones/${zoneId}/follow/bell`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ bell: bell === true }),
  });
  if (!response.ok) throw new Error(`Zone bell failed (${response.status})`);
  const data = await response.json();
  return data.data;
}

/** GET /api/verifications/host/:userId - Check if user is a verified host */
export async function checkHostVerification(userId) {
  const url = `${API_BASE_URL}/verifications/host/${userId}`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) return { is_verified: false, verification: null };
    const data = await response.json();
    return data.data || { is_verified: false, verification: null };
  } catch (error) {
    warn('Error checking host verification:', error);
    return { is_verified: false, verification: null };
  }
}

/** GET /api/messages?with_user_id= — legacy; Share-2-Person */
export async function getDirectMessages(withUserId) {
  const url = `${API_BASE_URL}/share?with_user_id=${withUserId}`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) throw new Error('Failed to fetch shares');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching shares:', error);
    throw error;
  }
}

/** POST /api/share — Share-2-Person nesne paylaşımı */
export async function sendShareObject(toUserId, { object_type, object_id, note, payload }) {
  const url = `${API_BASE_URL}/share`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      to_user_id: toUserId,
      object_type,
      object_id,
      note,
      payload,
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to send share');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchShareableObjects(type = 'memory', limit = 20) {
  const url = `${API_BASE_URL}/share/shareable?type=${encodeURIComponent(type)}&limit=${limit}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch shareable objects');
  }
  const data = await response.json();
  return data.data || [];
}

/** @deprecated use sendShareObject */
export async function sendDirectMessage(toUserId, content) {
  return sendShareObject(toUserId, {
    object_type: 'forward',
    object_id: null,
    note: String(content || '').trim(),
    payload: { legacy_dm: true },
  });
}

export async function fetchForumTargets(ritualId) {
  const url = `${API_BASE_URL}/forum/rituals/${ritualId}/targets`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to load forum');
  }
  return response.json();
}

export async function fetchForumComments(ritualId, { target_type, target_id } = {}) {
  const params = new URLSearchParams();
  if (target_type) params.set('target_type', target_type);
  if (target_id) params.set('target_id', target_id);
  const qs = params.toString();
  const url = `${API_BASE_URL}/forum/rituals/${ritualId}/comments${qs ? `?${qs}` : ''}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to load comments');
  const data = await response.json();
  return data.data || [];
}

export async function postForumComment(ritualId, body) {
  const url = `${API_BASE_URL}/forum/rituals/${ritualId}/comments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to post comment');
  }
  const data = await response.json();
  return data.data;
}

export async function voteForumComment(commentId, vote) {
  const url = `${API_BASE_URL}/forum/comments/${commentId}/vote`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ vote }),
  });
  if (!response.ok) throw new Error('Failed to vote');
  const data = await response.json();
  return data.data;
}

export async function fetchRitualReposts(ritualId, limit = 50) {
  const url = `${API_BASE_URL}/forum/rituals/${ritualId}/reposts?limit=${limit}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch ritual reposts');
  const data = await response.json();
  return data.data || [];
}

export async function repostToPulse(ritualId, { comment_id, memory_id }) {
  const url = `${API_BASE_URL}/forum/rituals/${ritualId}/repost`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ comment_id, memory_id }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to repost');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchPulseReposts({ limit = 20 } = {}) {
  const url = `${API_BASE_URL}/forum/reposts/pulse?limit=${limit}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch pulse reposts');
  const data = await response.json();
  return data.data || [];
}

export async function fetchPassportEntries({ limit = 50, offset = 0 } = {}) {
  const url = `${API_BASE_URL}/users/me/passport?limit=${limit}&offset=${offset}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch passport');
  const data = await response.json();
  return data.data;
}

export async function sendFriendRequest(userId, friendId) {
  const url = `${API_BASE_URL}/friends`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id: userId,
        friend_id: friendId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send friend request');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
}

export async function removeFriend(friendshipId, userId) {
  const url = `${API_BASE_URL}/friends/${friendshipId}?user_id=${userId}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove friend');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

export async function fetchPendingRequests(userId) {
  const url = `${API_BASE_URL}/friends/pending?user_id=${userId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
}

// User recent rituals
export async function fetchUserRecentRituals(userId, limit = 10) {
  const url = `${API_BASE_URL}/users/${userId}/rituals?limit=${limit}`;
  log('fetchUserRecentRituals - URL:', url);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching user recent rituals:', error);
    throw error;
  }
}

// RS Transparency API
export async function fetchRSHistory(userId, limit = 5) {
  const url = `${API_BASE_URL}/users/${userId}/rs-history?limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || {
      currentRS: null,
      feedbackCount: 0,
      changes: []
    };
  } catch (error) {
    console.error('Error fetching RS history:', error);
    throw error;
  }
}

// Participant Profile API (ritual context)
// Vibes API
export async function fetchUserVibes(userId) {
  const url = `${API_BASE_URL}/vibes/${userId}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (_error) {
    // 401/network etc.: fail silently so UI works without vibes
    return [];
  }
}

export async function addVibe(userId, vibe) {
  const url = `${API_BASE_URL}/vibes`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id: userId,
        vibe: vibe,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add vibe');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error adding vibe:', error);
    throw error;
  }
}

export async function removeVibe(userId, vibe) {
  const url = `${API_BASE_URL}/vibes`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id: userId,
        vibe: vibe,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove vibe');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error removing vibe:', error);
    throw error;
  }
}

export async function getVibeOptions() {
  const url = `${API_BASE_URL}/vibes/options/list`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      let err = null;
      try {
        err = await parseJsonResponse(response);
      } catch (_e) {
        // ignore parse errors, fallback to generic status below
      }
      throw new Error(err?.error || err?.message || `HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data || [];
  } catch (error) {
    console.error('Error fetching vibe options:', error);
    return [];
  }
}

export async function fetchPublicConfig() {
  const url = `${API_BASE_URL}/config/public`;
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' }, 15000);
    if (!response.ok) return null;
    const data = await parseJsonResponse(response);
    return data.data || null;
  } catch (error) {
    console.error('Error fetching public config:', error);
    return null;
  }
}

export async function submitBadgeLlmSuggestion({ suggested_slug, suggested_level = 'novice', reason, ritual_id } = {}) {
  const url = `${API_BASE_URL}/badges/llm/suggest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      suggested_slug,
      suggested_level,
      reason,
      ritual_id,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit badge suggestion');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchBadgeCatalog() {
  const url = `${API_BASE_URL}/badges/catalog`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch badge catalog');
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function fetchVenueBadges(venueId, { status } = {}) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  const url = `${API_BASE_URL}/venues/${venueId}/venue-badges${q.toString() ? `?${q}` : ''}`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch venue badges');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function createVenueBadge(venueId, payload) {
  const url = `${API_BASE_URL}/venues/${venueId}/venue-badges`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to create venue badge');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function fetchMyBadgesArchive() {
  const url = `${API_BASE_URL}/users/me/badges`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch badges');
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function updateHighlightedBadges(slugs = []) {
  const url = `${API_BASE_URL}/users/me/badges/highlighted`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ highlighted_badge_keys: slugs }),
  });
  if (!response.ok) {
    const err = await parseJsonResponse(response);
    throw new Error(err.error || 'Failed to update highlighted badges');
  }
  return parseJsonResponse(response);
}

export async function fetchWindowBubbles() {
  const url = `${API_BASE_URL}/users/me/window-bubbles`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch window bubbles');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function fetchRitualLiveActivity(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/live-activity`;
  const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch live activity');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function startRitualLiveActivity(ritualId, platform = 'expo') {
  const url = `${API_BASE_URL}/rituals/${ritualId}/live-activity/start`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ platform }),
  });
  if (!response.ok) {
    const err = await parseJsonResponse(response).catch(() => ({}));
    throw new Error(err.error || 'Failed to start live activity');
  }
  const data = await parseJsonResponse(response);
  return data.data;
}

export async function endRitualLiveActivity(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/live-activity/end`;
  const response = await fetch(url, { method: 'POST', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to end live activity');
  return parseJsonResponse(response);
}

export async function fetchUserRSBadges(userId) {
  const url = `${API_BASE_URL}/users/${userId}/rs-badges`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data || { badges: [] };
  } catch (error) {
    console.error('Error fetching user RS badges:', error);
    return { badges: [] };
  }
}

export async function fetchUserBehaviorBadges(userId) {
  const url = `${API_BASE_URL}/users/${userId}/behavior-badges`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data || { badges: [] };
  } catch (error) {
    console.error('Error fetching user behavior badges:', error);
    return { badges: [] };
  }
}

export async function fetchParticipantProfile(userId, ritualId, viewerId) {
  const url = `${API_BASE_URL}/users/${userId}/profile-in-ritual?ritual_id=${ritualId}&viewer_id=${viewerId}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      let err = null;
      try {
        err = await parseJsonResponse(response);
      } catch (_e) {
        // ignore parse errors, fallback to generic status below
      }
      // Fallback: profile-in-ritual may be restricted for some flows.
      // Return a safe basic profile instead of throwing and breaking UI.
      if (response.status === 403 || response.status === 404) {
        const basic = await fetchUserProfile(userId);
        if (basic?.closed_profile || basic?.minimal_card || basic?.account_privacy === 'CLOSED') {
          return {
            id: basic?.id || userId,
            name: basic?.name || 'Kullanici',
            username: basic?.username || null,
            avatar_url: basic?.avatar_url || null,
            account_privacy: 'CLOSED',
            closed_profile: true,
            minimal_card: true,
            connectionLevel: 'stranger',
            canMessageCta: false,
            isFriend: false,
            hasPendingRequest: false,
            pendingFriendshipId: null,
            currentRitual: null,
            pastRitualsTogether: [],
            fallbackReason: 'closed_profile',
          };
        }
        return {
          id: basic?.id || userId,
          name: basic?.name || 'Kullanici',
          city: basic?.city || '',
          university: basic?.university || '',
          rsScore: Number(basic?.rs_score ?? 5),
          rsRounded10: basic?.rs_rounded_10 ?? Math.round(Number(basic?.rs_score ?? 5)),
          rsExactVisible: !!basic?.rs_exact_visible,
          rsStatus: { label: 'Gorunur', color: '#1B2E4A' },
          isHost: Number(basic?.rituals_hosted || 0) > 0,
          isHostVerified: !!basic?.is_host_verified,
          ritualsAttended: Number(basic?.rituals_attended || 0),
          ritualsHosted: Number(basic?.rituals_hosted || 0),
          friendsCount: null,
          memberSince: basic?.created_at ? new Date(basic.created_at).getFullYear().toString() : '',
          sharedInterests: [],
          currentRitual: null,
          pastRitualsTogether: [],
          friendshipBadgesVisible: false,
          friendshipBadges: [],
          connectionLevel: 'stranger',
          canMessageCta: false,
          isFriend: false,
          hasPendingRequest: false,
          pendingFriendshipId: null,
          fallbackReason: err?.error || err?.message || 'restricted_profile_context',
        };
      }
      throw new Error(err?.error || err?.message || `HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data;
  } catch (error) {
    console.error('Error fetching participant profile:', error);
    throw error;
  }
}

export async function fetchUserMemoryGrid(userId, viewerId, limit = 24) {
  const queryParams = new URLSearchParams();
  if (viewerId) queryParams.append('viewer_id', viewerId);
  queryParams.append('limit', String(limit));
  const url = `${API_BASE_URL}/users/${userId}/memories?${queryParams.toString()}`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      let err = null;
      try {
        err = await parseJsonResponse(response);
      } catch (_e) {
        // ignore parse errors
      }
      throw new Error(err?.error || err?.message || `HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data;
  } catch (error) {
    console.error('Error fetching user memory grid:', error);
    return null;
  }
}

// Interests API
export async function fetchUserInterests(userId) {
  const url = `${API_BASE_URL}/interests/${userId}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (_error) {
    // 401/network etc.: fail silently so UI works without interests
    return [];
  }
}

export async function addUserInterest(userId, category) {
  const url = `${API_BASE_URL}/interests/${userId}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ category }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add interest');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error adding user interest:', error);
    throw error;
  }
}

export async function removeUserInterest(userId, category) {
  const url = `${API_BASE_URL}/interests/${userId}/${encodeURIComponent(category)}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove interest');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error removing user interest:', error);
    throw error;
  }
}

export async function fetchSharedInterests(userId, viewerId) {
  const url = `${API_BASE_URL}/interests/${userId}/shared/${viewerId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching shared interests:', error);
    return [];
  }
}

// Chat API
export async function fetchChatMessages(ritualId, limit = 50, before = null) {
  const queryParams = new URLSearchParams();
  queryParams.append('limit', limit);
  if (before) queryParams.append('before', before);
  
  const url = `${API_BASE_URL}/chat/${ritualId}/messages?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      // WaitingRoom pre-chat is non-critical; avoid crashing on access restrictions.
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    warn('Error fetching chat messages (non-fatal):', error?.message || error);
    return [];
  }
}

export async function sendChatMessage(ritualId, userId, message, messageType = 'user') {
  const url = `${API_BASE_URL}/chat/${ritualId}/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id: userId,
        message: message,
        message_type: messageType,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

/** sonMD: mesaj düzenleme 5dk */
export async function editChatMessage(messageId, content) {
  const url = `${API_BASE_URL}/chat/messages/${messageId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ content }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Mesaj düzenlenemedi');
  return data.data;
}

/** sonMD: soft delete — silindi izi */
export async function deleteChatMessage(messageId) {
  const url = `${API_BASE_URL}/chat/messages/${messageId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: buildJsonHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Mesaj silinemedi');
  return data.data;
}

/** sonMD reaction set: 🤝😂🙌👀💡❓ */
export async function reactToChatMessage(messageId, emoji) {
  const url = `${API_BASE_URL}/chat/messages/${messageId}/react`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ emoji }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Reaksiyon eklenemedi');
  return data.data;
}

/** Host ritual iptali — weather_cancel cezasız · birth_cancel hard-delete */
export async function cancelRitualAsHost(ritualId, { reason = 'host_cancel', category = null } = {}) {
  const qs = new URLSearchParams({ reason });
  if (category) qs.set('category', category);
  const url = `${API_BASE_URL}/rituals/${ritualId}?${qs.toString()}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...buildJsonHeaders(),
      Accept: 'application/json',
    },
    body: JSON.stringify({ reason, category }),
  });
  if (response.status === 204) return { success: true, cancel_reason: reason };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Ritual iptal edilemedi');
    err.code = data.code;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

/** §2D panel [yer veremedik] */
export async function venueNoCapacityCancel(venueId, ritualId) {
  const url = `${API_BASE_URL}/venues/${venueId}/rituals/${ritualId}/no-capacity`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İşlem başarısız');
  return data;
}

/** §2D venue_claim */
export async function claimVenueRitual(venueId, ritualId) {
  const url = `${API_BASE_URL}/venues/${venueId}/rituals/${ritualId}/claim`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Sahiplenilemedi');
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function fetchClaimableRituals(venueId, { limit = 20 } = {}) {
  const url = `${API_BASE_URL}/venues/${venueId}/claimable-rituals?limit=${limit}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Liste alınamadı');
  return data.data || [];
}

export async function fetchRitualWindow(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/window`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Window alınamadı');
    err.code = data.code;
    throw err;
  }
  return data.data;
}

export async function touchRitualWindowPresence(ritualId) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/window/presence`;
  const response = await fetch(url, { method: 'POST', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Presence güncellenemedi');
  return data.data;
}

export async function fetchAffiliatedHosts(orgKind, orgId) {
  const url = `${API_BASE_URL}/affiliations/orgs/${encodeURIComponent(orgKind)}/${encodeURIComponent(orgId)}/hosts`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Bağlı hostlar alınamadı');
  return data.data?.hosts || [];
}

export async function saveObject(objectType, objectId) {
  const url = `${API_BASE_URL}/social/saves`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ object_type: objectType, object_id: objectId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Kaydedilemedi');
  return data;
}

export async function unsaveObject(objectType, objectId) {
  const url = `${API_BASE_URL}/social/saves/${objectType}/${objectId}`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Kayıt kaldırılamadı');
  }
  return true;
}

export async function fetchSaves() {
  const url = `${API_BASE_URL}/social/saves`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Kayıtlar yüklenemedi');
  return data.data || [];
}

export async function muteObject({ objectType, objectId = null, objectKey = null }) {
  const url = `${API_BASE_URL}/social/mutes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      object_type: objectType,
      object_id: objectId,
      object_key: objectKey,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Sessize alınamadı');
  return data.data;
}

export async function unmuteObject(muteId) {
  const url = `${API_BASE_URL}/social/mutes/${muteId}`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Sessiz kaldırılamadı');
  }
  return true;
}

export async function fetchMutes() {
  const url = `${API_BASE_URL}/social/mutes`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Mute listesi yüklenemedi');
  return data.data || [];
}

export async function fetchFollowRequests() {
  const url = `${API_BASE_URL}/follows/requests`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İstekler yüklenemedi');
  return data.data || [];
}

export async function resolveFollowRequest(requestId, accept) {
  const url = `${API_BASE_URL}/follows/requests/${requestId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ action: accept ? 'accept' : 'decline' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İstek işlenemedi');
  return data;
}

export async function fetchCollaborators(scope, scopeId) {
  const url = `${API_BASE_URL}/collaborators/${scope}/${scopeId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Collaborators yüklenemedi');
  return data.data || [];
}

export async function addCollaborator(scope, scopeId, userId, permissions = ['announce', 'participant_comms', 'instance_manage']) {
  const url = `${API_BASE_URL}/collaborators/${scope}/${scopeId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ user_id: userId, permissions }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Collaborator eklenemedi');
  return data.data;
}

export async function revokeCollaborator(scope, scopeId, userId) {
  const url = `${API_BASE_URL}/collaborators/${scope}/${scopeId}/${userId}`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Collaborator kaldırılamadı');
  }
  return true;
}

export async function updateRitualFindNote(ritualId, findNote) {
  const url = `${API_BASE_URL}/rituals/${ritualId}/find-note`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ find_note: findNote }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'find_note güncellenemedi');
  return data.data;
}

export async function setActiveCity(cityId) {
  const url = `${API_BASE_URL}/users/me`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ active_city_id: cityId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'active_city güncellenemedi');
  return data.data;
}

export async function fetchCities(status) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const url = `${API_BASE_URL}/cities${q}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Şehir listesi alınamadı');
  return data.data || [];
}

/** Dünya ülke listesi — @countrystatecity (auth gerekmez) */
export async function fetchGeoCountries() {
  const url = `${API_BASE_URL}/geo/countries`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ülke listesi alınamadı');
  return { countries: data.data || [], meta: data.meta || {} };
}

/** Dünya şehirleri — country ISO2 + opsiyonel arama */
export async function fetchGeoCities(countryIso2, { q = '', limit = 80, offset = 0 } = {}) {
  const params = new URLSearchParams({
    country: String(countryIso2 || '').toUpperCase(),
    limit: String(limit),
    offset: String(offset),
  });
  if (q) params.set('q', q);
  const url = `${API_BASE_URL}/geo/cities?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Şehir listesi alınamadı');
  return data.data || { cities: [], total: 0, has_more: false };
}

export async function requestCityNotify(cityId) {
  const url = `${API_BASE_URL}/cities/${cityId}/notify-me`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Notify kaydı başarısız');
  return data.data;
}

export async function fetchVenuePortals(venueId) {
  const url = `${API_BASE_URL}/venues/${venueId}/portals`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Portals yüklenemedi');
  return {
    portals: data.data || [],
    multi_room_flag: Boolean(data.multi_room_flag),
    can_add_table_totem: data.can_add_table_totem !== false,
    table_totem_reason: data.table_totem_reason || null,
  };
}

/** label yalnız multi_room_flag açık mekanda kabul edilir (sonMD portal seti) */
export async function createVenuePortal(venueId, { portalId, label = null } = {}) {
  const url = `${API_BASE_URL}/venues/${venueId}/portals`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ portal_id: portalId, label }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Totem oluşturulamadı');
  return data.data;
}

export async function deleteVenuePortal(venueId, portalId) {
  const url = `${API_BASE_URL}/venues/${venueId}/portals/${encodeURIComponent(portalId)}`;
  const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Totem silinemedi');
  return true;
}

export async function sendChatRichMessage(ritualId, userId, message, options = {}) {
  const url = `${API_BASE_URL}/chat/${ritualId}/messages`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id: userId,
        message,
        message_type: options.message_type || 'user',
        type: options.type || 'text',
        media_url: options.media_url || null,
        external_url: options.external_url || null,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send rich message');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error sending rich chat message:', error);
    throw error;
  }
}

export async function sendChatMediaMessage(ritualId, userId, media) {
  const baseUrl = `${API_BASE_URL}/chat/${ritualId}/messages`;
  const uploadType = media?.upload_type === 'voice' ? 'voice' : 'photo';
  const contentType = media?.content_type || (uploadType === 'voice' ? 'audio/m4a' : 'image/jpeg');

  try {
    // Resolve file size from uri if not provided
    const localResp = await fetch(media.uri);
    const blob = await localResp.blob();
    const fileSizeBytes = Number(media.file_size_bytes || blob.size || 0);

    const initResp = await fetch(baseUrl, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        mode: 'init_upload',
        user_id: userId,
        message: media.caption || '[media]',
        upload_type: uploadType,
        content_type: contentType,
        file_size_bytes: fileSizeBytes,
        capture_source: media.capture_source || (uploadType === 'photo' ? 'camera' : undefined),
      }),
    });
    const initJson = await parseJsonResponse(initResp);
    if (!initResp.ok) {
      throw new Error(initJson?.error || 'Failed to init media upload');
    }

    const uploadUrl = initJson?.data?.upload_url;
    const storageKey = initJson?.data?.storage_key;
    const messageId = initJson?.data?.message_id;
    if (!uploadUrl || !storageKey || !messageId) {
      throw new Error('Upload session response is missing required fields');
    }

    const putResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!putResp.ok) {
      // Some local/dev setups can reject direct PUT to presigned URL (403).
      // Fall back to sending a rich chat message without upload.
      if (putResp.status === 401 || putResp.status === 403) {
        const fallback = await sendChatRichMessage(
          ritualId,
          userId,
          media.caption || '[media]',
          {
            type: media.type || (uploadType === 'voice' ? 'voice' : 'photo'),
            media_url: media.uri || null,
            external_url: media.external_url || null,
          }
        );
        return fallback;
      }
      throw new Error(`Upload failed with status ${putResp.status}`);
    }

    const finalizeResp = await fetch(baseUrl, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        mode: 'finalize_upload',
        user_id: userId,
        message: media.caption || '[media]',
        caption: media.caption || null,
        message_id: messageId,
        storage_key: storageKey,
        upload_type: uploadType,
        type: media.type || (uploadType === 'voice' ? 'voice' : 'photo'),
        external_url: media.external_url || null,
        capture_source: media.capture_source || (uploadType === 'photo' ? 'camera' : undefined),
      }),
    });
    const finalizeJson = await parseJsonResponse(finalizeResp);
    if (!finalizeResp.ok) {
      throw new Error(finalizeJson?.error || 'Failed to finalize media upload');
    }

    return finalizeJson?.data || null;
  } catch (error) {
    warn('Error sending chat media message:', error?.message || error);
    throw error;
  }
}

// Memories API
export async function fetchRitualMemories(ritualId, limit = 20, userId = null, opts = {}) {
  const queryParams = new URLSearchParams();
  queryParams.append('limit', limit);
  if (userId) {
    queryParams.append('user_id', userId);
  }
  if (opts.archive) {
    queryParams.append('archive', '1');
  }
  const url = `${API_BASE_URL}/memories/ritual/${ritualId}?${queryParams.toString()}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.data ?? [];
  } catch (error) {
    return [];
  }
}

// Alias for fetchRitualMemories (for backward compatibility)
export async function fetchMemories(ritualId, limit = 20) {
  return fetchRitualMemories(ritualId, limit);
}

export async function fetchMemoryDetail(memoryId) {
  const url = `${API_BASE_URL}/memories/${memoryId}`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      let err = null;
      try {
        err = await parseJsonResponse(response);
      } catch (_e) {
        // ignore parse errors
      }
      throw new Error(err?.error || err?.message || `HTTP error! status: ${response.status}`);
    }
    const data = await parseJsonResponse(response);
    return data.data || null;
  } catch (error) {
    warn('Error fetching memory detail (non-fatal):', error?.message || error);
    return null;
  }
}

/** Sosyal §6 — ▲ / ▼ vote (her iki sayaç public; ▼ push yok) */
export async function voteMemory(memoryId, vote) {
  const url = `${API_BASE_URL}/memories/${memoryId}/vote`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ vote }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to vote');
  }
  const data = await response.json();
  return data.data;
}

/** §15 — Yankı */
export async function echoMemory(memoryId) {
  const url = `${API_BASE_URL}/memories/${memoryId}/echo`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to echo');
  }
  const data = await response.json();
  return data.data;
}

/** §15 — Söz (text-only) */
export async function sozMemory(memoryId, body) {
  const url = `${API_BASE_URL}/memories/${memoryId}/soz`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ body: String(body || '').trim() }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add soz');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchPulseMemories(city = null, limit = 10, viewerId = null, { scope } = {}) {
  const queryParams = new URLSearchParams();
  if (city) queryParams.append('city', city);
  queryParams.append('limit', limit);
  if (viewerId) queryParams.append('viewer_id', viewerId);
  if (scope) queryParams.append('scope', scope);
  
  const url = `${API_BASE_URL}/memories/pulse?${queryParams.toString()}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      log('fetchPulseMemories non-OK response:', response.status);
      return [];
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    log('Error fetching pulse memories (non-fatal):', error?.message || error);
    return [];
  }
}

// Venue Activity API for Pulse
export async function fetchVenueActivity(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.city) queryParams.append('city', params.city);
  if (params.viewerId) queryParams.append('viewer_id', params.viewerId);
  queryParams.append('limit', String(params.limit ?? 12));

  const url = `${API_BASE_URL}/rituals/venue-activity?${queryParams.toString()}`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });

    if (!response.ok) {
      log('fetchVenueActivity non-OK response:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    log('Error fetching venue activity (non-fatal):', error?.message || error);
    return [];
  }
}

// Check eligibility to share memory to Pulse
export async function checkMemoryEligibility(ritualId, userId) {
  const url = `${API_BASE_URL}/memories/eligibility?ritual_id=${ritualId}&user_id=${userId}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { eligible: false, reason: 'Not eligible' };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || { eligible: false, reason: 'Unknown error' };
  } catch (error) {
    return { eligible: false, reason: 'Failed to check eligibility' };
  }
}

export async function createMemory(ritualId, userId, content, memoryTypeOrOpts = 'ritual', spotifyPlaylistUrl = null) {
  const url = `${API_BASE_URL}/memories`;

  let opts = {};
  if (memoryTypeOrOpts && typeof memoryTypeOrOpts === 'object') {
    opts = memoryTypeOrOpts;
  } else {
    opts = {
      memoryType: memoryTypeOrOpts,
      spotifyUrl: spotifyPlaylistUrl,
    };
  }

  const memoryType = opts.memoryType || opts.memory_type || 'ritual';
  const memoryScope = opts.memoryScope || opts.memory_scope || null;
  const body = {
    ritual_id: ritualId,
    user_id: userId,
    content,
    memory_type: memoryType,
    spotify_playlist_url: opts.spotifyUrl || opts.spotify_playlist_url || null,
  };
  if (memoryScope) body.memory_scope = memoryScope;
  if (opts.audience) body.audience = opts.audience;
  if (opts.type) body.type = opts.type;
  if (opts.destination) body.destination = opts.destination;
  if (opts.status) body.status = opts.status;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create memory');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error creating memory:', error);
    throw error;
  }
}

/** §3 — in-app camera photo/video → S3 init/put/finalize (immutable stamp on server) */
export async function createMemoryMedia(ritualId, userId, media = {}, opts = {}) {
  const url = `${API_BASE_URL}/memories`;
  const uploadType = media.upload_type === 'video' ? 'video' : 'photo';
  const contentType =
    media.content_type ||
    (uploadType === 'video' ? 'video/mp4' : 'image/jpeg');
  const durationSeconds = Number(media.duration_seconds || 0);

  const localResp = await fetch(media.uri);
  const blob = await localResp.blob();
  const fileSizeBytes = Number(media.file_size_bytes || blob.size || 0);

  const memoryType =
    opts.memoryType || opts.memory_type || (opts.shareType === 'pulse' || opts.shareType === 'all' ? 'pulse' : 'ritual');
  const memoryScope =
    opts.memoryScope ||
    opts.memory_scope ||
    (opts.shareType === 'all' || opts.shareType === 'CITY'
      ? 'all'
      : opts.shareType === 'pulse' || opts.shareType === 'CIRCLE'
        ? 'pulse'
        : 'solo');
  const audience =
    opts.audience ||
    (opts.shareType === 'all' || opts.shareType === 'CITY'
      ? 'CITY'
      : opts.shareType === 'pulse' || opts.shareType === 'CIRCLE'
        ? 'CIRCLE'
        : 'WINDOW');
  const status = opts.status === 'draft' ? 'draft' : 'published';

  const initResp = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      mode: 'init_upload',
      ritual_id: ritualId,
      user_id: userId,
      memory_type: status === 'draft' ? 'ritual' : memoryType,
      upload_type: uploadType,
      content_type: contentType,
      file_size_bytes: fileSizeBytes,
      duration_seconds: durationSeconds || undefined,
      capture_source: media.capture_source || 'camera',
    }),
  });
  const initJson = await parseJsonResponse(initResp);
  if (!initResp.ok) {
    throw new Error(initJson?.error || 'Failed to init memory upload');
  }

  const uploadUrl = initJson?.data?.upload_url;
  const storageKey = initJson?.data?.storage_key;
  const memoryId = initJson?.data?.memory_id;
  if (!uploadUrl || !storageKey || !memoryId) {
    throw new Error('Upload session missing fields');
  }

  const putResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResp.ok) {
    throw new Error(`Upload failed (${putResp.status})`);
  }

  const finalizeResp = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      mode: 'finalize_upload',
      ritual_id: ritualId,
      user_id: userId,
      memory_id: memoryId,
      storage_key: storageKey,
      upload_type: uploadType,
      content_type: contentType,
      duration_seconds: durationSeconds || undefined,
      caption: opts.caption || media.caption || (uploadType === 'video' ? '🎬' : '📸'),
      memory_type: status === 'draft' ? 'ritual' : memoryType,
      memory_scope: memoryScope,
      audience,
      status,
      type: uploadType === 'video' ? 'media' : 'photo',
      capture_source: media.capture_source || 'camera',
    }),
  });
  const finalizeJson = await parseJsonResponse(finalizeResp);
  if (!finalizeResp.ok) {
    throw new Error(finalizeJson?.error || 'Failed to finalize memory upload');
  }
  return finalizeJson?.data || null;
}

export async function fetchRuloMemories() {
  const url = `${API_BASE_URL}/memories/me/rulo`;
  const response = await fetch(url, { headers: buildJsonHeaders() });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data?.error || 'Failed to fetch Rulo');
  return data?.data || [];
}

export async function publishMemory(memoryId, { memoryScope, audience } = {}) {
  const url = `${API_BASE_URL}/memories/${memoryId}/publish`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      memory_scope: memoryScope || 'solo',
      audience: audience || undefined,
    }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throw new Error(data?.error || 'Failed to publish memory');
  return data;
}

export async function deleteMemory(memoryId, userId) {
  const url = `${API_BASE_URL}/memories/${memoryId}?user_id=${userId}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete memory');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
}

// Safety API
export async function fetchPendingHostWitness() {
  const url = `${API_BASE_URL}/mod/host-witness/pending`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function answerHostWitness(reportId, answer) {
  const url = `${API_BASE_URL}/mod/host-witness/${reportId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ answer }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Witness answer failed');
  }
  return (await response.json()).data;
}

export async function fetchMyModSanctions() {
  const url = `${API_BASE_URL}/mod/sanctions/me`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function createModAppeal({ actionId, reason }) {
  const url = `${API_BASE_URL}/mod/appeals`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ action_id: actionId, reason }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Appeal failed');
  }
  return (await response.json()).data;
}

export async function sanctionFalseReporterApi({ reporterId, escalate = false, secondModeratorId = null }) {
  const url = `${API_BASE_URL}/mod/false-reporter`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      reporter_id: reporterId,
      escalate,
      second_moderator_id: secondModeratorId,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'False reporter sanction failed');
  }
  return (await response.json()).data;
}

export async function fetchModCategories(lang = 'tr') {
  const url = `${API_BASE_URL}/mod/categories?lang=${encodeURIComponent(lang)}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

/** v2 §5 unified report → /api/mod/reports (tek kuyruk) */
export async function createModReport({
  targetType,
  targetId = null,
  ritualId = null,
  categoryKey,
  description = null,
  leaveAfter = false,
  queueLane = null,
}) {
  const url = `${API_BASE_URL}/mod/reports`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      target_type: targetType,
      target_id: targetId,
      ritual_id: ritualId,
      category_key: categoryKey,
      description,
      leave_after: Boolean(leaveAfter),
      queue_lane: queueLane,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to submit mod report');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchZone(zoneId) {
  const url = `${API_BASE_URL}/zones/${zoneId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Zone not found');
  }
  const data = await response.json();
  return data.data;
}

export async function scanZoneMarker(zoneId) {
  const url = `${API_BASE_URL}/zones/${zoneId}/marker-scan`;
  const response = await fetch(url, { method: 'POST', headers: buildJsonHeaders(), body: '{}' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Marker scan failed');
  }
  const data = await response.json();
  return data.data;
}

export async function startZoneSpark(zoneId, payload = {}) {
  const url = `${API_BASE_URL}/zones/${zoneId}/spark`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'SPARK unavailable');
  }
  const data = await response.json();
  return data.data;
}

export async function joinZoneSpark(meetupId) {
  const url = `${API_BASE_URL}/zones/spark/${meetupId}/join`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'SPARK join failed');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchZoneSpark(meetupId) {
  const url = `${API_BASE_URL}/zones/spark/${meetupId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

export async function fetchEventGroupUmbrella(eventGroupId) {
  const url = `${API_BASE_URL}/event-groups/${eventGroupId}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

export async function fetchLiveEventGroups() {
  const url = `${API_BASE_URL}/event-groups/live`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function fetchZones(params = {}) {
  const q = new URLSearchParams();
  if (params.lat != null) q.append('lat', String(params.lat));
  if (params.lng != null) q.append('lng', String(params.lng));
  if (params.limit) q.append('limit', String(params.limit));
  const url = `${API_BASE_URL}/zones${q.toString() ? `?${q}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function fetchModQueue(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.append('status', params.status);
  if (params.limit) q.append('limit', String(params.limit));
  if (params.offset) q.append('offset', String(params.offset));
  const url = `${API_BASE_URL}/mod/reports?${q.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) throw new Error('Failed to fetch mod queue');
  const data = await response.json();
  return data.data || [];
}

export async function applyModLevelAction(payload) {
  const url = `${API_BASE_URL}/mod/actions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to apply mod action');
  }
  const data = await response.json();
  return data.data;
}

export async function createLocationShare({ friendId, ritualId }) {
  const url = `${API_BASE_URL}/mod/location-share`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ friend_id: friendId, ritual_id: ritualId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Location share failed');
  }
  const data = await response.json();
  return data.data;
}

export async function fetchModAppeals(status = 'pending') {
  const url = `${API_BASE_URL}/mod/appeals?status=${encodeURIComponent(status)}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function resolveModAppeal(appealId, { decision, decision_note }) {
  const url = `${API_BASE_URL}/mod/appeals/${appealId}/resolve`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ decision, decision_note }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Appeal resolve failed');
  }
  return (await response.json()).data;
}

export async function submitReport(reportData) {
  return await createModReport({
    targetType: reportData.report_type || reportData.target_type || 'user',
    targetId: reportData.reported_user_id || reportData.target_id || reportData.reported_id,
    ritualId: reportData.ritual_id,
    categoryKey: reportData.category_key || reportData.reason,
    description: reportData.description,
    leaveAfter: reportData.leave_after,
  });
}

export async function reportUser(reporterId, reportedUserId, reason, description = null, opts = {}) {
  return await createModReport({
    targetType: opts.targetType || 'user',
    targetId: reportedUserId,
    ritualId: opts.ritualId || null,
    categoryKey: reason,
    description,
    leaveAfter: Boolean(opts.leaveAfter),
  });
}

export async function reportMessage(reporterId, messageId, ritualId, reason, description = null, opts = {}) {
  return await createModReport({
    targetType: opts.targetType || 'prelobby_message',
    targetId: messageId,
    ritualId,
    categoryKey: reason,
    description,
    leaveAfter: Boolean(opts.leaveAfter),
  });
}

export async function blockUser(blockerId, blockedUserId) {
  const url = `${API_BASE_URL}/safety/block`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        blocker_id: blockerId,
        blocked_user_id: blockedUserId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to block user');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

export async function unblockUser(blockerId, blockedUserId) {
  const url = `${API_BASE_URL}/safety/block/${blockedUserId}?blocker_id=${blockerId}`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unblock user');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

export async function fetchBlockedUsers(blockerId) {
  const url = `${API_BASE_URL}/safety/blocked?blocker_id=${blockerId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    throw error;
  }
}

export async function emergencyExit(ritualId, userId) {
  const url = `${API_BASE_URL}/safety/emergency-exit`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        ritual_id: ritualId,
        user_id: userId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process emergency exit');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error processing emergency exit:', error);
    throw error;
  }
}

// Settings API
export async function fetchUserSettings(userId) {
  const url = `${API_BASE_URL}/users/${userId}/settings`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching user settings:', error);
    throw error;
  }
}

export async function updateUserSettings(userId, settings) {
  const url = `${API_BASE_URL}/users/${userId}/settings`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildJsonHeaders(),
      body: JSON.stringify(settings),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update settings');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
}

/** GET /api/users/:id/blocked-keywords */
export async function fetchBlockedKeywords(userId) {
  const url = `${API_BASE_URL}/users/${userId}/blocked-keywords`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) throw new Error('Failed to fetch blocked keywords');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching blocked keywords:', error);
    throw error;
  }
}

/** POST /api/users/:id/blocked-keywords */
export async function addBlockedKeyword(userId, keyword) {
  const url = `${API_BASE_URL}/users/${userId}/blocked-keywords`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ keyword: keyword.trim() }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add keyword');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error adding blocked keyword:', error);
    throw error;
  }
}

/** DELETE /api/users/:id/blocked-keywords/:keyword */
export async function removeBlockedKeyword(userId, keyword) {
  const url = `${API_BASE_URL}/users/${userId}/blocked-keywords/${encodeURIComponent(keyword.trim())}`;
  try {
    const response = await fetch(url, { method: 'DELETE', headers: buildJsonHeaders() });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to remove keyword');
    }
    return (await response.json()).data;
  } catch (error) {
    console.error('Error removing blocked keyword:', error);
    throw error;
  }
}

/** GET /api/users/:id/export-data - Export user data (JSON) */
export async function exportUserData(userId) {
  const url = `${API_BASE_URL}/users/${userId}/export-data`;
  try {
    const response = await fetchWithRetry(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to export data');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error exporting user data:', error);
    throw error;
  }
}

/** Sosyal §3 — self-serve hesap silme (confirmPhrase: SIL) */
export async function deleteOwnAccount(userId, confirmPhrase = 'SIL') {
  const url = `${API_BASE_URL}/users/${userId}/account`;
  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ confirm: confirmPhrase }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Hesap silinemedi');
  }
  return data.data;
}

export async function updateUserProfile(userId, profile) {
  // Prefer PATCH /me for v2 visibility flags; fall back to PUT /:id
  const visibilityKeys = [
    'uni_label_visible',
    'hosted_count_visible',
    'regular_vitrine_visible',
    'bio_quote_memory_id',
  ];
  const hasVisibility = visibilityKeys.some((k) => profile?.[k] !== undefined);
  if (hasVisibility) {
    const patchUrl = `${API_BASE_URL}/users/me`;
    const response = await fetch(patchUrl, {
      method: 'PATCH',
      headers: buildJsonHeaders(),
      body: JSON.stringify(profile),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update profile');
    }
    const data = await response.json();
    return data.data;
  }

  const url = `${API_BASE_URL}/users/${userId}`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildJsonHeaders(),
      body: JSON.stringify(profile),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function uploadProfilePhoto(userId, base64Image) {
  const url = `${API_BASE_URL}/users/${userId}/avatar`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ image: base64Image }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload photo');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
}

// Moderation API (Spec 5.X.9)
export async function fetchReports(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.offset) queryParams.append('offset', params.offset);
  
  const url = `${API_BASE_URL}/mod/reports${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch reports');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
}

export async function updateReportStatus(reportId, status, reviewedBy = null) {
  void reviewedBy;
  throw new Error(
    `Legacy status update removed. Use /mod/actions with an explicit level for report ${reportId} (requested status: ${status}).`
  );
}

export async function fetchAnalyticsSummary() {
  const url = `${API_BASE_URL}/analytics/summary`;
  try {
    const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch analytics');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

export async function fetchCheckinFunnel({ days = 7, includeOps = true } = {}) {
  const q = new URLSearchParams();
  q.set('days', String(days));
  q.set('include_ops', includeOps ? '1' : '0');
  const url = `${API_BASE_URL}/mod/checkin-funnel?${q.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: buildJsonHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Funnel yuklenemedi');
  }
  return json.data || json;
}

export async function patchTotemOps(id, status) {
  const url = `${API_BASE_URL}/mod/totem-ops/${id}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ status }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Totem kuyrugu guncellenemedi');
  }
  return json.data || json;
}

export async function createCheckinFieldNote({ ritualId, venueId, checklistKey, note }) {
  const url = `${API_BASE_URL}/mod/checkin-field-notes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      ritual_id: ritualId || null,
      venue_id: venueId || null,
      checklist_key: checklistKey,
      note,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || 'Saha notu kaydedilemedi');
  }
  return json.data || json;
}

export async function suspendUser(userId) {
  const url = `${API_BASE_URL}/safety/admin/suspend-user`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to suspend user');
  }
  return (await response.json()).data;
}

export async function unsuspendUser(userId) {
  const url = `${API_BASE_URL}/safety/admin/unsuspend-user`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to unsuspend user');
  }
  return (await response.json()).data;
}

export async function suspendRitual(ritualId) {
  const url = `${API_BASE_URL}/safety/admin/suspend-ritual`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ ritual_id: ritualId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to suspend ritual');
  }
  return (await response.json()).data;
}

export async function unsuspendRitual(ritualId) {
  const url = `${API_BASE_URL}/safety/admin/unsuspend-ritual`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ ritual_id: ritualId }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to unsuspend ritual');
  }
  return (await response.json()).data;
}

// ==================== AUTH API ====================

/**
 * Register new user
 * Track A: university email required
 * Track B: track: 'identity' — any email, provisional JWT for KYC
 */
export async function register(email, password, name, city, university, options = {}) {
  const url = `${API_BASE_URL}/auth/register`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
        city,
        university,
        track: options.track || undefined,
      }),
    });
    
    const data = await parseJsonResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    return data;
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(email, password) {
  const url = `${API_BASE_URL}/auth/login`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      }),
    }, 4); // 5 attempts for auth - rate limit often hits login
    
    const data = await parseJsonResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    return data;
  } catch (error) {
    warn('Error logging in (non-fatal):', error?.message || error);
    throw error;
  }
}

/**
 * Get current user (requires token)
 */
export async function getCurrentUser(token) {
  const url = `${API_BASE_URL}/auth/me`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    }, 4); // 5 attempts for auth
    
    const data = await parseJsonResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
}

/**
 * Verify email with 6-digit OTP code
 */
export async function verifyEmailCode(email, code) {
  const url = `${API_BASE_URL}/auth/verify-email/confirm`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Email verification failed');
    }

    return data;
  } catch (error) {
    console.error('Error verifying email code:', error);
    throw error;
  }
}

/**
 * Verify email with token
 */
export async function verifyEmail(token) {
  const url = `${API_BASE_URL}/auth/verify-email/${token}`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await parseJsonResponse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Email verification failed');
    }
    
    return data;
  } catch (error) {
    console.error('Error verifying email:', error);
    throw error;
  }
}

/**
 * Resend verification email
 */
export async function resendVerification(email) {
  const url = `${API_BASE_URL}/auth/resend-verification`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend verification email');
    }
    
    return data;
  } catch (error) {
    console.error('Error resending verification:', error);
    throw error;
  }
}

/**
 * Request password reset
 */
export async function forgotPassword(email) {
  const url = `${API_BASE_URL}/auth/forgot-password`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send password reset email');
    }
    
    return data;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token, password) {
  const url = `${API_BASE_URL}/auth/reset-password`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Password reset failed');
    }
    
    return data;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

/**
 * Check if email is from a university domain (real-time validation)
 * On network failure, returns { valid: false, _networkError: true } so UI can show "Unable to verify"
 * without surfacing an unhandled error overlay.
 */
export async function checkUniversityFromEmail(email) {
  const url = `${API_BASE_URL}/auth/check-university`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check university');
    }
    
    return data.data;
  } catch (error) {
    const isNetworkError =
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'TypeError';
    if (isNetworkError) {
      return { valid: false, _networkError: true };
    }
    throw error;
  }
}

export async function submitUniversityReviewRequest({ email, universityName, website }) {
  const url = `${API_BASE_URL}/auth/university-request`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        university_name: universityName,
        website,
      }),
    });

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit university review request');
    }

    return data.data;
  } catch (error) {
    const isNetworkError =
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'TypeError';
    if (isNetworkError) {
      const e = new Error('Baglanti nedeniyle talep gonderilemedi. Lutfen tekrar dene.');
      e._networkError = true;
      throw e;
    }
    throw error;
  }
}