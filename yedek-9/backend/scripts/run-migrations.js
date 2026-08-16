/**
 * LOCAL migration runner
 * - Tracks applied files in schema_migrations
 * - Bootstraps tracking for existing DBs (marks pre-v2 as applied)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'local_db',
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD,
});

const migrationFiles = [
  '001_initial_schema.sql',
  '002_chat_memory_schema.sql',
  '003_safety_antigaming_schema.sql',
  '004_bc3_trend_schema.sql',
  '005_bc3_fix_delta_before.sql',
  '006_diversity_state_schema.sql',
  '007_follow_system_schema.sql',
  '008_notifications_schema.sql',
  '009_vibe_pills_schema.sql',
  '010_spotify_playlist_schema.sql',
  '011_verification_schema.sql',
  '012_user_settings_schema.sql',
  '013_user_interests_schema.sql',
  '014_add_cancelled_status.sql',
  '015_ritual_advanced_fields.sql',
  '016_add_auth_fields.sql',
  '017_ritual_invites_schema.sql',
  '018_direct_messages_schema.sql',
  '019_user_settings_notify_extras.sql',
  '020_suspend_user_ritual.sql',
  '021_reports_action_note.sql',
  '022_admin_audit_log.sql',
  '023_venues_schema.sql',
  '024_user_avatar.sql',
  '025_privacy_settings_extended.sql',
  '026_blocked_keywords.sql',
  '027_rs_history_and_report_templates.sql',
  '028_lte3_trust_engine.sql',
  '029_university_verification_requests.sql',
  '030_user_badges.sql',
  '031_unique_checkin_keyword.sql',
  '032_memory_privacy_mode.sql',
  '033_notification_types_v46.sql',
  '034_feedback_type_p2m.sql',
  '035_venue_subscription_tiers.sql',
  '036_refresh_tokens.sql',
  '037_users_schema_alignment_v1.sql',
  '038_universities_schema_alignment_v1.sql',
  '039_cities_schema_alignment_v1.sql',
  '040_rituals_schema_alignment_v1.sql',
  '041_rituals_doc_compliance_cleanup.sql',
  '042_ritual_participants_alignment_v1.sql',
  '043_friendships_alignment_v1.sql',
  '044_rs_transactions_alignment_v1.sql',
  '045_feedbacks_alignment_v1.sql',
  '046_memories_alignment_v1.sql',
  '047_memories_ritual_nullable.sql',
  '048_memory_tags_alignment_v1.sql',
  '049_venues_alignment_v1.sql',
  '050_venue_ratings_alignment_v1.sql',
  '051_badges_alignment_v1.sql',
  '052_user_badges_alignment_v1.sql',
  '053_notifications_alignment_v1.sql',
  '054_chat_messages_alignment_v1.sql',
  '055_reports_alignment_v1.sql',
  '056_email_verifications_alignment_v1.sql',
  '057_university_registration_requests_alignment_v1.sql',
  '058_pii_location_security_v1.sql',
  '059_pulse_feed_indexes.sql',
  '060_checkin_ais_v1.sql',
  '061_ritual_state_enum_v1.sql',
  '062_ritual_state_machine_v1.sql',
  '063_fl_feedback_counter_v1.sql',
  '064_penalties_v7.sql',
  '065_ds_engine_v1.sql',
  '066_content_layer_v1.sql',
  '067_notifications_v1.sql',
  '068_venue_applications_v1.sql',
  '069_venue_profile_v1.sql',
  '070_venue_slots_v1.sql',
  '071_venue_archive_index.sql',
  '072_badge_engine_f6.sql',
  '073_venue_business_stub.sql',
  '074_spec_completion_v1.sql',
  '075_completion_v2.sql',
  '076_notif_gap_completion.sql',
  '077_spec_section1_completion.sql',
  '078_venue_section9_completion.sql',
  '079_badge_section10_completion.sql',
  '080_notif_section11_completion.sql',
  '081_score_events_v1.sql',
  '082_v2_delta_wave1.sql',
  '083_v2_delta_waves2_5.sql',
  '084_identity_gate_v2.sql',
  '084_mod_engine_v2.sql',
  '085_venue_economy_v2.sql',
  '086_venue_economy_gaps.sql',
  '087_badge_section9_v2.sql',
  '088_chip_badge_bridge.sql',
  '089_zone_spark_section11.sql',
  '090_search_discovery_section12.sql',
  '091_notification_extras_section13.sql',
  '092_profile_passport_section14.sql',
  '093_gps_distance_log.sql',
  '094_v2_first_seal_witness.sql',
  '095_users_verified_and_invite_phaseb_removal.sql',
  '096_keyword_v2_origin_and_subseal.sql',
  '097_event_sub_seal_constraints.sql',
  '098_presence_ticket_and_self_rez_mode.sql',
  '099_feedback_type_p2z.sql',
  '100_search_discovery_section12_completion.sql',
  '101_rs_ring_toggle_cooldown.sql',
  '102_wave_b_sonmd.sql',
  '103_mention_ghost_cleanup.sql',
  '104_under_min_find_note_city.sql',
  '105_city_notify_stubs.sql',
  '106_event_general_rq.sql',
  '107_identity_username_name_lock.sql',
  '108_drop_ghost_and_escrow.sql',
  '109_privacy_data_prefs.sql',
  '110_friends_dm_waitlist.sql',
  '111_sonmd_pct100_gaps.sql',
  '112_series_regular_f15.sql',
  '113_notif_quiet_digest.sql',
  '114_city_country_seed.sql',
  '115_checkin_funnel_events.sql',
  '116_checkin_sonmd_gaps.sql',
  '117_checkin_relay_sub_fb.sql',
  '118_ritual_fee_audience.sql',
  '119_venue_leads_repeat_pin.sql',
  '120_sosyal_pct100_gaps.sql',
  '121_lokasyon_pct100.sql',
  '122_dort_cephe_pct100.sql',
];

const V2_START = '082_v2_delta_wave1.sql';

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedSet() {
  const r = await pool.query(`SELECT filename FROM schema_migrations`);
  return new Set(r.rows.map((row) => row.filename));
}

async function bootstrapExistingDb(appliedSet) {
  if (appliedSet.size > 0) return appliedSet;

  const exists = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'
     ) AS ok`
  );
  if (!exists.rows[0]?.ok) return appliedSet;

  console.log('ℹ️  Existing DB detected without schema_migrations history.');
  console.log('   Bootstrapping: marking pre-v2 migrations (001–081) as applied.');
  console.log('   Will run only pending v2 files (082+).');
  console.log('');

  for (const file of migrationFiles) {
    if (file === V2_START || file > V2_START) break;
    await pool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
      [file]
    );
    appliedSet.add(file);
  }
  return appliedSet;
}

async function markApplied(filename) {
  await pool.query(
    `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
    [filename]
  );
}

async function runMigrations() {
  const migrationsDir = join(__dirname, '../src/migrations');

  try {
    await ensureMigrationsTable();
    let appliedSet = await getAppliedSet();
    appliedSet = await bootstrapExistingDb(appliedSet);

    console.log('🔄 Starting database migrations...');
    console.log(`📁 Database: ${process.env.DB_NAME || 'local_db'}`);
    console.log(`👤 User: ${process.env.DB_USER || process.env.USER}`);
    console.log('');

    let successCount = 0;
    let skipCount = 0;

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  ${file} (already applied)`);
        skipCount++;
        continue;
      }

      const filePath = join(migrationsDir, file);

      try {
        const sql = readFileSync(filePath, 'utf8');
        console.log(`📄 Running ${file}...`);
        await pool.query(sql);
        await markApplied(file);
        console.log(`✅ ${file} completed`);
        successCount++;
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`⚠️  ${file} not found, skipping...`);
          skipCount++;
        } else if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('already applied')
        ) {
          console.log(`ℹ️  ${file} already applied, recording & skipping...`);
          await markApplied(file);
          skipCount++;
        } else {
          console.error(`❌ ${file} failed:`, error.message);
          console.error('');
          console.error('💡 To fix:');
          console.error(`   1. Check the SQL syntax in: ${filePath}`);
          console.error(`   2. Fix the error and run: npm run migrate`);
          console.error('');
          throw error;
        }
      }
    }

    console.log('');
    console.log('✅ All migrations completed!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. Database exists: CREATE DATABASE local_db;');
    console.error('  3. .env file has correct credentials');
    return false;
  }
}

(async () => {
  const connected = await testConnection();
  if (connected) {
    await runMigrations();
  } else {
    process.exit(1);
  }
})();
