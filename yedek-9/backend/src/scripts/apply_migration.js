import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration(migrationFile) {
  try {
    console.log(`📄 Applying migration: ${migrationFile}...`);
    
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log(`✅ Migration ${migrationFile} applied successfully!`);
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`⚠️  Migration ${migrationFile} already applied (table/index exists)`);
      return true;
    }
    console.error(`❌ Error applying migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Usage: node apply_migration.js <migration_file>');
    console.error('Example: node apply_migration.js 004_bc3_trend_schema.sql');
    process.exit(1);
  }
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Check if table already exists
    if (migrationFile.includes('bc3') || migrationFile.includes('004')) {
      const exists = await checkTableExists('rs_delta_history');
      if (exists) {
        console.log('✅ rs_delta_history table already exists');
        console.log('   Migration may have already been applied.\n');
      }
    }
    
    // Apply migration
    const success = await applyMigration(migrationFile);
    
    if (success) {
      console.log('\n🎉 Migration process completed!');
    } else {
      console.log('\n❌ Migration process failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
