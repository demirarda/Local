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
});

let productionPool = null;

export function getProductionPool() {
  if (!process.env.PRODUCTION_DATABASE_URL && !process.env.PRODUCTION_DB_NAME) {
    return null;
  }
  if (!productionPool) {
    productionPool = new Pool({
      connectionString: process.env.PRODUCTION_DATABASE_URL,
      host: process.env.PRODUCTION_DB_HOST || process.env.DB_HOST || 'localhost',
      port: process.env.PRODUCTION_DB_PORT || process.env.DB_PORT || 5432,
      database: process.env.PRODUCTION_DB_NAME || process.env.DB_NAME || 'local_db',
      user: process.env.PRODUCTION_DB_USER || process.env.DB_USER,
      password: process.env.PRODUCTION_DB_PASSWORD || process.env.DB_PASSWORD,
    });
  }
  return productionPool;
}

export default pool;
