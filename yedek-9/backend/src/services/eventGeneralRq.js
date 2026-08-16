/**
 * EVENT gece-geneli RQ — sonMD 🔒
 * Sub'lı event FB ekranında ek soru: "gece geneli nasıldı"
 * Son-sub RQ (p2r) masayı ölçer; rq_event geceyi ölçer · RS'e girmez.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export function isEventGeneralRqEnabled() {
  return LOCAL_CONFIG.chip?.EVENT_GENERAL_RQ_ENABLED !== false;
}

/**
 * Sub'lı event: event_group_id VEYA ritual_event_sub_seals kaydı
 */
export async function shouldAskEventGeneralRq(ritualId, client = pool) {
  if (!isEventGeneralRqEnabled() || !ritualId) return false;

  const ritual = await client.query(
    `SELECT id, event_group_id FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!ritual.rows[0]) return false;

  if (ritual.rows[0].event_group_id) {
    const siblings = await client.query(
      `SELECT COUNT(*)::int AS c FROM rituals
       WHERE event_group_id = $1 AND suspended_at IS NULL`,
      [ritual.rows[0].event_group_id]
    );
    if (Number(siblings.rows[0]?.c || 0) >= 1) return true;
  }

  const subs = await client.query(
    `SELECT COUNT(*)::int AS c FROM ritual_event_sub_seals
     WHERE ritual_id = $1`,
    [ritualId]
  ).catch(() => ({ rows: [{ c: 0 }] }));

  return Number(subs.rows[0]?.c || 0) > 0;
}

export async function eventGeneralRqMeta(ritualId) {
  const ask = await shouldAskEventGeneralRq(ritualId);
  return {
    event_general_rq: ask,
    event_general_rq_enabled: isEventGeneralRqEnabled(),
    question_key: 'fb_event_general_q',
  };
}
