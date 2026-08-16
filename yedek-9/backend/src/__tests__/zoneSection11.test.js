import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { isSparkEnabled } from '../services/zoneService.js';
import {
  foldRitualsWithUmbrellas,
  buildUmbrellaPayload,
} from '../services/eventGroupService.js';

describe('zone §11', () => {
  test('SPARK flag disabled (post-v1 stub)', () => {
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
    expect(isSparkEnabled()).toBe(false);
  });

  test('badge points config', () => {
    expect(LOCAL_CONFIG.zone.BADGE_RITUAL_P).toBe(3);
    expect(LOCAL_CONFIG.zone.MARKER_P).toBe(1);
  });

  test('foldRitualsWithUmbrellas passes through ungrouped', async () => {
    const rows = [{ id: 'a', title: 'Solo', event_group_id: null }];
    const out = await foldRitualsWithUmbrellas(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  test('buildUmbrellaPayload exposes seats_left and sibling suggestions', () => {
    const umbrella = buildUmbrellaPayload(
      { id: 'eg1', name: 'LOCAL @ Emirgan', capacity_total: 12 },
      [
        { id: 't1', title: 'Masa 1', capacity: 4, joined: 4 },
        { id: 't2', title: 'Masa 2', capacity: 4, joined: 1 },
        { id: 't3', title: 'Masa 3', capacity: 4, joined: 4 },
      ]
    );

    expect(umbrella.card_type).toBe('event_group');
    expect(umbrella.table_count).toBe(3);
    expect(umbrella.joined).toBe(9);
    expect(umbrella.seats_left).toBe(3);
    expect(umbrella.suggest_other_tables).toBe(true);

    const full = umbrella.tables.find((t) => t.id === 't1');
    expect(full.seats_left).toBe(0);
    expect(full.is_full).toBe(true);
    expect(full.suggest_other_tables).toHaveLength(1);
    expect(full.suggest_other_tables[0]).toMatchObject({
      id: 't2',
      seats_left: 3,
    });

    const open = umbrella.tables.find((t) => t.id === 't2');
    expect(open.seats_left).toBe(3);
    expect(open.is_full).toBe(false);
    expect(open.suggest_other_tables).toEqual([]);
  });

  test('foldRitualsWithUmbrellas collapses group via injected resolver (no DB)', async () => {
    const umbrella = buildUmbrellaPayload(
      { id: 'eg1', name: 'LOCAL @ Emirgan', capacity_total: 8 },
      [
        { id: 't1', title: 'A', capacity: 4, joined: 2 },
        { id: 't2', title: 'B', capacity: 4, joined: 1 },
      ]
    );
    const rows = [
      { id: 't1', title: 'A', event_group_id: 'eg1' },
      { id: 'solo', title: 'Solo', event_group_id: null },
      { id: 't2', title: 'B', event_group_id: 'eg1' },
    ];
    const out = await foldRitualsWithUmbrellas(rows, {
      resolveUmbrella: async () => ({ ok: true, umbrella }),
    });
    expect(out).toHaveLength(2);
    expect(out[0].card_type).toBe('event_group');
    expect(out[0].id).toBe('eg1');
    expect(out[0].tables.every((t) => typeof t.seats_left === 'number')).toBe(true);
    expect(out[1].id).toBe('solo');
  });
});
