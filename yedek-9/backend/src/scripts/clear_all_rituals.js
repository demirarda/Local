/**
 * Tüm Pulse ve City Rhythm verilerini siler.
 * Ritüellere bağlı tabloları (FK sırasına göre) temizler, sonra rituals tablosunu boşaltır.
 *
 * Kullanım: node src/scripts/clear_all_rituals.js
 */

import pool from '../config/database.js';

async function clearAllRituals() {
  const client = await pool.connect();
  try {
    console.log('🧹 Pulse & City Rhythm verileri siliniyor...\n');

    // Önce ritüel sayısını al
    const countResult = await client.query('SELECT COUNT(*) AS cnt FROM rituals');
    const ritualCount = parseInt(countResult.rows[0].cnt, 10);
    if (ritualCount === 0) {
      console.log('✅ Zaten ritüel yok. Çıkılıyor.');
      return;
    }

    // İlişkili tabloları sil (CASCADE olsa bile sıralı silme daha güvenli)
    const tables = [
      ['feedback', 'ritual_id'],
      ['ritual_attendance', 'ritual_id'],
      ['chat_messages', 'ritual_id'],
      ['memories', 'ritual_id'],
      ['ritual_invites', 'ritual_id'],
      ['rs_delta_history', 'ritual_id'],
      ['reports', 'reported_ritual_id'],
    ];

    for (const [table, col] of tables) {
      try {
        const res = await client.query(
          `DELETE FROM ${table} WHERE ${col} IN (SELECT id FROM rituals)`
        );
        if (res.rowCount > 0) {
          console.log(`   ${table}: ${res.rowCount} kayıt silindi`);
        }
      } catch (e) {
        if (e.code !== '42P01' && e.code !== '42703') throw e;
      }
    }

    try {
      await client.query(
        `UPDATE user_badges SET source_ritual_id = NULL, ritual_id = NULL
         WHERE source_ritual_id IN (SELECT id FROM rituals) OR ritual_id IN (SELECT id FROM rituals)`
      );
    } catch (e) {
      if (e.code !== '42P01' && e.code !== '42703') throw e;
    }

    // Ritüelleri sil
    const delRituals = await client.query('DELETE FROM rituals');
    console.log(`\n✅ rituals: ${delRituals.rowCount} ritüel silindi.`);
    console.log('   Pulse ve City Rhythm verileri temizlendi.\n');
  } catch (error) {
    console.error('❌ Hata:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllRituals().catch(() => process.exit(1));
