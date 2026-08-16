/**
 * Sentry error tracking for mobile app.
 * Only initializes when EXPO_PUBLIC_SENTRY_DSN is set.
 */
let sentryInitialized = false;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      enabled: !__DEV__ || !!process.env.EXPO_PUBLIC_SENTRY_DEV_ENABLED,
    });
    sentryInitialized = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('Sentry init failed:', error?.message);
    }
  }
}

export function captureException(error, context = {}) {
  if (!sentryInitialized) return;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.captureException(error, { extra: context });
  } catch (_) {}
}

export function setSentryUser(user) {
  if (!sentryInitialized || !user) return;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.setUser({ id: user.id, username: user.name });
  } catch (_) {}
}

export function clearSentryUser() {
  if (!sentryInitialized) return;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.setUser(null);
  } catch (_) {}
}
