/**
 * son-part1.md §2 — score_events append-only log
 */
import pool from '../config/database.js';
import { LOCAL_CONFIG, LOCAL_CONFIG_VERSION } from '../config/localConfig.js';

/** §2 — her çarpan ayrı satır (kalibrasyon şeffaflığı). */
export const RS_PIPELINE_SCORE_EVENT_TYPES = [
  'rs_mult_conf',
  'rs_mult_ds',
  'rs_mult_bc',
  'rs_mult_md',
  'rs_mult_br',
  'rs_cap',
];

/**
 * Pipeline çarpanlarını score_events satırlarına çevirir (DB yok).
 * delta = o adımın delta'ya net etkisi (delta_out − delta_in).
 */
export function buildRsPipelineScoreEvents({
  ritualIndex,
  iqMeta = {},
  pipeline,
  dayCap = null,
} = {}) {
  if (!pipeline) return [];
  const n = Number(iqMeta.n || 0);
  const deltaRawCapped = Number(pipeline.deltaRawCapped ?? pipeline.deltaRaw ?? 0);
  const deltaAfterDs = Number(pipeline.deltaAfterDs ?? deltaRawCapped);
  const deltaAfterBc = Number(pipeline.deltaAfterBc ?? deltaAfterDs);
  const deltaAfterMd = Number(pipeline.deltaAfterMd ?? deltaAfterBc);
  const deltaAfterBr = Number(pipeline.deltaAfterBr ?? deltaAfterMd);
  const deltaFinal = Number(pipeline.deltaFinal ?? deltaAfterBr);

  return [
    {
      eventType: 'rs_mult_conf',
      delta: null,
      inputs: { ritual_index: ritualIndex, n, iq_null: !!iqMeta.iq_null },
      breakdown: {
        factor: 'CONF',
        n,
        conf: iqMeta.conf ?? null,
        iq_raw: iqMeta.IQ_raw ?? null,
        iq_blended: iqMeta.IQ_r ?? null,
        iq_null: !!iqMeta.iq_null,
        n1_neutral: LOCAL_CONFIG.rs.IQ_BLEND_N1_NEUTRAL,
        n1_raw: LOCAL_CONFIG.rs.IQ_BLEND_N1_RAW,
        n2_raw: LOCAL_CONFIG.rs.IQ_BLEND_N2_RAW,
        n2_neutral: LOCAL_CONFIG.rs.IQ_BLEND_N2_NEUTRAL,
      },
    },
    {
      eventType: 'rs_mult_ds',
      delta: deltaAfterDs - deltaRawCapped,
      inputs: { ritual_index: ritualIndex },
      breakdown: {
        factor: 'DS',
        mult: pipeline.dsMult,
        applied: !!pipeline.dsApplied,
        delta_in: deltaRawCapped,
        delta_out: deltaAfterDs,
      },
    },
    {
      eventType: 'rs_mult_bc',
      delta: deltaAfterBc - deltaAfterDs,
      inputs: { ritual_index: ritualIndex },
      breakdown: {
        factor: 'BC',
        mult: pipeline.bcMult,
        applied: !!pipeline.bcApplied,
        delta_in: deltaAfterDs,
        delta_out: deltaAfterBc,
      },
    },
    {
      eventType: 'rs_mult_md',
      delta: deltaAfterMd - deltaAfterBc,
      inputs: { ritual_index: ritualIndex },
      breakdown: {
        factor: 'MD',
        mult: pipeline.mdMult,
        delta_in: deltaAfterBc,
        delta_out: deltaAfterMd,
      },
    },
    {
      eventType: 'rs_mult_br',
      delta: deltaAfterBr - deltaAfterMd,
      inputs: { ritual_index: ritualIndex },
      breakdown: {
        factor: 'BR',
        mult: pipeline.brMult,
        delta_in: deltaAfterMd,
        delta_out: deltaAfterBr,
      },
    },
    {
      eventType: 'rs_cap',
      delta: deltaFinal - deltaAfterBr,
      inputs: { ritual_index: ritualIndex },
      breakdown: {
        factor: 'CAP',
        ritual_pos: LOCAL_CONFIG.rs.CAP_POS,
        ritual_neg: LOCAL_CONFIG.rs.CAP_NEG,
        day_pos: LOCAL_CONFIG.rs.CAP_DAY_POS,
        delta_in: deltaAfterBr,
        delta_out: deltaFinal,
        day: dayCap,
      },
    },
  ];
}

export async function logRsPipelineScoreEvents({
  userId,
  ritualId = null,
  ritualIndex,
  iqMeta,
  pipeline,
  dayCap = null,
}) {
  const rows = buildRsPipelineScoreEvents({ ritualIndex, iqMeta, pipeline, dayCap });
  for (const row of rows) {
    await logScoreEvent({ userId, ritualId, ...row });
  }
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string|null} [params.ritualId]
 * @param {string} params.eventType
 * @param {number|null} [params.delta]
 * @param {object} [params.inputs]
 * @param {object} [params.breakdown]
 */
export async function logScoreEvent({
  userId,
  ritualId = null,
  eventType,
  delta = null,
  inputs = {},
  breakdown = {},
}) {
  if (!userId || !eventType) return;
  try {
    await pool.query(
      `INSERT INTO score_events (user_id, ritual_id, event_type, delta, inputs, breakdown, config_version)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        userId,
        ritualId,
        eventType,
        delta,
        JSON.stringify(inputs || {}),
        JSON.stringify(breakdown || {}),
        LOCAL_CONFIG_VERSION,
      ]
    );
  } catch (e) {
    if (e.code !== '42P01') {
      console.error('score_events insert failed:', e.message);
    }
  }
}

export async function listScoreEventsForUser(userId, { limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT id, user_id, ritual_id, event_type, delta, inputs, breakdown, config_version, created_at
     FROM score_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 50, 200)]
  );
  return r.rows;
}

export default { logScoreEvent, logRsPipelineScoreEvents, listScoreEventsForUser };
