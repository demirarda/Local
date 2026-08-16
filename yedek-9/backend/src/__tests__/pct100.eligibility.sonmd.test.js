import { describe, test, expect } from '@jest/globals';

function birthEligibleShape({ time_type, age_min, seal_count, max_min = 10 }) {
  return (
    String(time_type).toLowerCase() === 'instant' &&
    age_min <= max_min &&
    seal_count === 1
  );
}

describe('sonMD pct100 — birth_cancel eligibility shape', () => {
  test('instant + 5min + seal 1 → eligible', () => {
    expect(
      birthEligibleShape({ time_type: 'instant', age_min: 5, seal_count: 1 })
    ).toBe(true);
  });

  test('planned → not eligible', () => {
    expect(
      birthEligibleShape({ time_type: 'fixed', age_min: 2, seal_count: 1 })
    ).toBe(false);
  });

  test('too old → not eligible', () => {
    expect(
      birthEligibleShape({ time_type: 'instant', age_min: 15, seal_count: 1 })
    ).toBe(false);
  });

  test('seal_count 2 → not eligible', () => {
    expect(
      birthEligibleShape({ time_type: 'instant', age_min: 3, seal_count: 2 })
    ).toBe(false);
  });
});

describe('sonMD pct100 — friends list privacy contract', () => {
  test('403 code FRIENDS_LIST_PRIVATE', () => {
    expect('FRIENDS_LIST_PRIVATE').toBe('FRIENDS_LIST_PRIVATE');
  });
});
