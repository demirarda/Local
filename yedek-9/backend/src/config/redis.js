import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Import logger (lazy import to avoid circular dependency)
let logger;
(async () => {
  const loggerModule = await import('../utils/logger.js');
  logger = loggerModule.default;
})();

redisClient.on('error', (err) => {
  if (logger) {
    logger.error('Redis Client Error', { error: err.message, stack: err.stack });
  } else {
    console.error('❌ Redis Client Error:', err);
  }
});

redisClient.on('connect', () => {
  if (logger) {
    logger.info('Redis connected');
  } else {
    console.log('✅ Redis connected');
  }
});

// Connect to Redis (skip persistent connection during tests to avoid open handles)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      if (logger) {
        logger.error('Failed to connect to Redis', { error: err.message, stack: err.stack });
      } else {
        console.error('Failed to connect to Redis:', err);
      }
    }
  })();
}

export default redisClient;
