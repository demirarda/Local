import 'dotenv/config';
import pool from '../config/database.js';

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || '200541032@firat.edu.tr';

const VENUES = [
  {
    name: 'Karakoy Brew House',
    city: 'Istanbul',
    address: 'Kilic Ali Pasa Mah. Mumhane Cad. No:21, Beyoglu',
    description: 'Specialty coffee and brunch venue by the waterfront.',
    location_lat: 41.025606,
    location_lng: 28.982219,
    slug: 'karakoy-brew-house',
  },
  {
    name: 'Moda Sahne Loft',
    city: 'Istanbul',
    address: 'Caferaga Mah. Moda Cad. No:50, Kadikoy',
    description: 'Live music and intimate performance space.',
    location_lat: 40.986514,
    location_lng: 29.028821,
    slug: 'moda-sahne-loft',
  },
  {
    name: 'Kordon Social Club',
    city: 'Izmir',
    address: 'Akdeniz Mah. Kordonboyu Cad. No:14, Konak',
    description: 'Community-friendly venue for social rituals and meetups.',
    location_lat: 38.423734,
    location_lng: 27.142826,
    slug: 'kordon-social-club',
  },
  {
    name: 'Tunali Rooftop Studio',
    city: 'Ankara',
    address: 'Kavaklidere Mah. Tunali Hilmi Cad. No:91, Cankaya',
    description: 'Rooftop studio for workshops, yoga and networking.',
    location_lat: 39.909706,
    location_lng: 32.860238,
    slug: 'tunali-rooftop-studio',
  },
];

async function ensureVenue(client, venue) {
  const result = await client.query(
    `INSERT INTO venues (name, city, address, description, location_lat, location_lng, slug, subscription_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pro')
     ON CONFLICT (name, city) DO UPDATE
     SET address = EXCLUDED.address,
         description = EXCLUDED.description,
         location_lat = EXCLUDED.location_lat,
         location_lng = EXCLUDED.location_lng,
         slug = EXCLUDED.slug
     RETURNING id`,
    [venue.name, venue.city, venue.address, venue.description, venue.location_lat, venue.location_lng, venue.slug]
  );
  return result.rows[0].id;
}

async function ensureVenueVerification(client, venue) {
  await client.query(
    `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, verified_at, expires_at, status)
     VALUES ($1, $2, 'admin', 'standard', NOW(), NOW() + INTERVAL '365 days', 'active')
     ON CONFLICT (venue_name, city) DO UPDATE
     SET status = 'active',
         verified_at = COALESCE(venue_verifications.verified_at, NOW()),
         expires_at = NOW() + INTERVAL '365 days'`,
    [venue.name, venue.city]
  );
}

async function ensureVenueFollow(client, userId, venueId) {
  await client.query(
    `INSERT INTO venue_follows (user_id, venue_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, venue_id) DO NOTHING`,
    [userId, venueId]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const target = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [TARGET_EMAIL]
    );
    if (!target.rows[0]) {
      throw new Error(`Target user not found for email: ${TARGET_EMAIL}`);
    }
    const userId = target.rows[0].id;

    let venuesAdded = 0;
    for (const venue of VENUES) {
      const venueId = await ensureVenue(client, venue);
      await ensureVenueVerification(client, venue);
      await ensureVenueFollow(client, userId, venueId);
      venuesAdded += 1;
    }

    await client.query('COMMIT');
    console.log(`✅ Real venues upserted: ${venuesAdded}`);
    console.log(`✅ Venue follows ensured for ${TARGET_EMAIL}: ${venuesAdded}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ seed_real_venues_following failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
