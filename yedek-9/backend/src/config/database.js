import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'local_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Import logger (lazy import to avoid circular dependency)
let logger;
(async () => {
  const loggerModule = await import('../utils/logger.js');
  logger = loggerModule.default;
})();

// Test connection
pool.on('connect', () => {
  if (logger) {
    logger.info('Database connected');
  } else {
    console.log('✅ Database connected');
  }
});

pool.on('error', (err) => {
  if (logger) {
    logger.error('Database connection error', { error: err.message, stack: err.stack });
  } else {
    console.error('❌ Database connection error:', err);
  }
});

export default pool;
