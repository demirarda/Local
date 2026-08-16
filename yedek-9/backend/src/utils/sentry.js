/**
 * Sentry error tracking integration
 * Only initializes in production or if SENTRY_DSN is provided
 */

let sentryInitialized = false;

export function initSentry() {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    return;
  }

  try {
    const Sentry = require('@sentry/node');
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
      release: process.env.APP_VERSION || '1.0.0',
      
      // Filter out health check requests
      beforeSend(event, hint) {
        // Don't send health check errors
        if (event.request?.url?.includes('/health')) {
          return null;
        }
        return event;
      },
    });

    sentryInitialized = true;
    console.log('✅ Sentry initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
  }
}

export function captureException(error, context = {}) {
  if (!sentryInitialized) {
    return;
  }

  try {
    const Sentry = require('@sentry/node');
    Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    // Silently fail if Sentry is not available
  }
}

export function captureMessage(message, level = 'info', context = {}) {
  if (!sentryInitialized) {
    return;
  }

  try {
    const Sentry = require('@sentry/node');
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } catch (err) {
    // Silently fail if Sentry is not available
  }
}

export function setUser(user) {
  if (!sentryInitialized) {
    return;
  }

  try {
    const Sentry = require('@sentry/node');
    Sentry.setUser({
      id: user.id,
      username: user.name,
    });
  } catch (err) {
    // Silently fail if Sentry is not available
  }
}
