import Bull from 'bull';
import logger from '../utils/logger.js';
import { updateRSForRitualParticipants } from './rsEngine.js';
import { evaluateBadgesForRitual } from './badgeEvaluation.js';
import { updateDsForUser } from './dsEngine.js';
import { applyFriendshipLevelOnCheckin } from './friendshipLevel.js';
import { recordLateCancelEvent, recordNoShowEvent, recordHostNoShowEvent } from './rsBypass.js';
import { sendNotificationToUser } from './notifications.js';
import { cleanupExpiredMemories } from '../api/memories.js';
import { captureException } from '../utils/sentry.js';
import {
  sendAnnouncementEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from './email.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// backend-yeni.md queue names
const queueNames = [
  'rs-calculation',
  'rs-bypass',
  'badge-evaluation',
  'ds-update',
  'notification-send',
  'email-send',
  'fl-update',
  'feedback-deadline',
  'ritual-reminder',
  'venue-daily-digest',
  'media-cleanup',
];

const queues = {};
let initialized = false;

function makeQueue(name) {
  return new Bull(name, redisUrl, {
    settings: {
      backoffStrategies: {
        staged: (attemptsMade) => {
          const delays = [1000, 10000, 60000];
          return delays[Math.max(0, Math.min(attemptsMade - 1, delays.length - 1))];
        },
      },
    },
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'staged',
      },
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  });
}

async function wireProcessors() {
  // RS calculation
  queues['rs-calculation'].process(async (job) => {
    const { ritual_id } = job.data;
    if (!ritual_id) return { skipped: true, reason: 'missing_ritual_id' };
    try {
      const { isRitualUnderMin } = await import('./underMinGate.js');
      if (await isRitualUnderMin(ritual_id)) {
        return { skipped: true, reason: 'under_min', ritual_id };
      }
    } catch (_e) {
      /* continue */
    }
    const updates = await updateRSForRitualParticipants(ritual_id);
    return { ritual_id, updated_count: updates.length };
  });

  // Feedback deadline window closed -> trigger RS + badge evaluation
  queues['feedback-deadline'].process(async (job) => {
    const { ritual_id, mode, user_id, title } = job.data || {};
    if (!ritual_id) return { skipped: true, reason: 'missing_ritual_id' };
    if (mode === 'notify' && user_id) {
      const { notifyFeedbackClosing } = await import('./notifications.js');
      await notifyFeedbackClosing(user_id, { id: ritual_id, title }).catch(() => {});
      return { ritual_id, notified_user: user_id };
    }
    try {
      const { isRitualUnderMin } = await import('./underMinGate.js');
      if (await isRitualUnderMin(ritual_id)) {
        return { skipped: true, reason: 'under_min', ritual_id };
      }
    } catch (_e) {
      /* continue */
    }
    await enqueue('rs-calculation', { ritual_id }, { priority: 10 });
    await enqueue('badge-evaluation', { ritual_id }, { priority: 5 });
    return { ritual_id, triggered: ['rs-calculation', 'badge-evaluation'] };
  });

  // RS bypass penalties for no_show / late_cancel
  queues['rs-bypass'].process(async (job) => {
    const { action, user_id, ritual_id, hours_until_start, pct_until_start } = job.data || {};
    if (!action || !user_id || !ritual_id) {
      return { skipped: true, reason: 'missing_rs_bypass_fields' };
    }
    if (action === 'no_show') {
      return await recordNoShowEvent(user_id, ritual_id);
    }
    if (action === 'late_cancel') {
      return await recordLateCancelEvent(user_id, ritual_id, {
        pct_until_start:
          pct_until_start != null
            ? Number(pct_until_start)
            : hours_until_start != null
              ? null
              : undefined,
        hours_until_start: hours_until_start != null ? Number(hours_until_start) : undefined,
      });
    }
    if (action === 'host_no_show') {
      return await recordHostNoShowEvent(user_id, ritual_id);
    }
    return { skipped: true, reason: 'unsupported_rs_bypass_action' };
  });

  // Badge evaluation and progress updates
  queues['badge-evaluation'].process(async (job) => {
    const { ritual_id } = job.data || {};
    return await evaluateBadgesForRitual(ritual_id);
  });

  // DS update (asynchronous per participation)
  queues['ds-update'].process(async (job) => {
    const { user_id, ritual_id } = job.data || {};
    return await updateDsForUser(user_id, ritual_id ?? null);
  });

  // Friendship level update
  queues['fl-update'].process(async (job) => {
    const { ritual_id, user_id } = job.data || {};
    if (!ritual_id || !user_id) return { skipped: true, reason: 'missing_fl_inputs' };
    return await applyFriendshipLevelOnCheckin(ritual_id, user_id);
  });

  // Notification send
  queues['notification-send'].process(async (job) => {
    const { user_id, type, title, body, data } = job.data;
    if (!user_id || !type || !title || !body) {
      return { skipped: true, reason: 'missing_notification_fields' };
    }
    return await sendNotificationToUser(user_id, type, title, body, data || {});
  });

  // Email send
  queues['email-send'].process(async (job) => {
    const { kind, payload } = job.data || {};
    if (kind === 'verification') {
      return await sendVerificationEmail(payload?.email, payload?.token);
    }
    if (kind === 'password_reset') {
      return await sendPasswordResetEmail(payload?.email, payload?.token);
    }
    if (kind === 'welcome') {
      return await sendWelcomeEmail(payload?.email, payload?.name);
    }
    if (kind === 'announcement') {
      return await sendAnnouncementEmail(payload?.to, payload?.subject, payload?.body);
    }
    return { skipped: true, reason: 'unsupported_email_kind' };
  });

  // Ritual reminder queue (cron-driven)
  queues['ritual-reminder'].process(async (job) => {
    const { user_id, ritual_id, title } = job.data || {};
    if (!user_id || !ritual_id) return { skipped: true, reason: 'missing_reminder_fields' };
    return await sendNotificationToUser(
      user_id,
      'ritual_reminder',
      'Ritual Hatırlatıcısı',
      `${title || 'Ritual'} 2 saat içinde başlıyor`,
      { ritual_id, ritual_title: title }
    );
  });

  // Venue daily digest queue (08:00)
  queues['venue-daily-digest'].process(async (job) => {
    const { user_id, venue_id, venue_name, ritual_id, ritual_title } = job.data || {};
    if (!user_id || !venue_id) return { skipped: true, reason: 'missing_venue_digest_fields' };
    return await sendNotificationToUser(
      user_id,
      'venue_update',
      'Mekan Güncellemesi',
      `${venue_name || 'Mekan'} için bugün Ritual var`,
      { venue_id, venue_name, ritual_id, ritual_title }
    );
  });

  // Media cleanup queue (daily 02:00)
  queues['media-cleanup'].process(async () => {
    return await cleanupExpiredMemories();
  });

  // Remaining queues: placeholders to keep contract names active
  for (const name of queueNames) {
    if (
      name === 'rs-calculation' ||
      name === 'rs-bypass' ||
      name === 'notification-send' ||
      name === 'email-send' ||
      name === 'feedback-deadline' ||
      name === 'badge-evaluation' ||
      name === 'ds-update' ||
      name === 'fl-update' ||
      name === 'ritual-reminder' ||
      name === 'venue-daily-digest' ||
      name === 'media-cleanup'
    ) continue;
    queues[name].process(async (job) => {
      logger.info('Queue placeholder processed', { queue: name, jobId: job.id });
      return { queue: name, accepted: true };
    });
  }
}

function wireErrorLogging() {
  for (const name of queueNames) {
    const q = queues[name];
    q.on('failed', (job, err) => {
      logger.error('Queue job failed', {
        queue: name,
        jobId: job?.id,
        error: err?.message,
      });
      captureException(err, {
        queue: name,
        jobId: job?.id,
        payload: job?.data,
      });
    });
  }
}

export async function initQueueSystem() {
  if (initialized) return queues;
  if (process.env.QUEUE_ENABLED === 'false') {
    logger.info('Queue system disabled via QUEUE_ENABLED=false');
    initialized = true;
    return queues;
  }

  for (const name of queueNames) {
    queues[name] = makeQueue(name);
  }
  await wireProcessors();
  wireErrorLogging();
  initialized = true;
  logger.info('Queue system initialized', { queues: queueNames });
  return queues;
}

export async function enqueue(queueName, data = {}, opts = {}) {
  if (!initialized) {
    await initQueueSystem();
  }
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`);
  }
  return queue.add(data, opts);
}

export async function closeQueueSystem() {
  const all = Object.values(queues);
  await Promise.all(all.map((q) => q.close()));
}

export { queueNames };
