import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import {
  isFounderUser,
  isVenuePlatformOverride,
  resolveProductOpsRole,
} from '../services/productOpsRoles.js';

const KEYS = [
  'FOUNDER_USER_IDS',
  'FOUNDER_EMAILS',
  'OPS_MODERATOR_USER_IDS',
  'OPS_MODERATOR_EMAILS',
  'OPS_VENUE_OPS_USER_IDS',
  'OPS_VENUE_OPS_EMAILS',
  'OPS_SUPPORT_USER_IDS',
  'OPS_SUPPORT_EMAILS',
  'OPS_READONLY_USER_IDS',
  'OPS_READONLY_EMAILS',
  'ADMIN_USER_IDS',
  'ADMIN_EMAILS',
];

describe('product Ops roles env', () => {
  const snapshot = {};

  beforeEach(() => {
    for (const k of KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  test('ADMIN_* alone is not founder and has no Ops role', () => {
    process.env.ADMIN_EMAILS = 'admin@local';
    process.env.ADMIN_USER_IDS = 'admin-uuid';
    expect(resolveProductOpsRole('admin-uuid', 'admin@local')).toBeNull();
    expect(isFounderUser('admin-uuid', 'admin@local')).toBe(false);
    expect(isVenuePlatformOverride('admin-uuid', 'admin@local')).toBe(true);
  });

  test('FOUNDER_* is founder; L3 gate does not use ADMIN_*', () => {
    process.env.FOUNDER_EMAILS = 'arda@local';
    process.env.ADMIN_EMAILS = 'other-admin@local';
    expect(resolveProductOpsRole(null, 'arda@local')).toBe('founder');
    expect(isFounderUser(null, 'arda@local')).toBe(true);
    expect(isFounderUser(null, 'other-admin@local')).toBe(false);
    expect(isVenuePlatformOverride(null, 'arda@local')).toBe(true);
  });

  test('OPS_* lists map 1:1 and founder wins', () => {
    process.env.OPS_MODERATOR_EMAILS = 'mod@local';
    process.env.OPS_VENUE_OPS_EMAILS = 'venues@local';
    process.env.OPS_SUPPORT_EMAILS = 'help@local';
    process.env.OPS_READONLY_EMAILS = 'watch@local';
    process.env.FOUNDER_EMAILS = 'mod@local';
    expect(resolveProductOpsRole(null, 'mod@local')).toBe('founder');
    expect(resolveProductOpsRole(null, 'venues@local')).toBe('venue_ops');
    expect(resolveProductOpsRole(null, 'help@local')).toBe('support');
    expect(resolveProductOpsRole(null, 'watch@local')).toBe('read_only');
  });

  test('moderator email is moderator even if also ADMIN_*', () => {
    process.env.ADMIN_EMAILS = 'mod@local';
    process.env.OPS_MODERATOR_EMAILS = 'mod@local';
    expect(resolveProductOpsRole(null, 'mod@local')).toBe('moderator');
    expect(isFounderUser(null, 'mod@local')).toBe(false);
  });
});
