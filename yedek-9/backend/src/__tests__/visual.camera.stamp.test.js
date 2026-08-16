import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  assertCameraCaptureSource,
  buildStampLabel,
  formatStampDay,
} from '../services/memoryStamp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

describe('§3 in-app camera + damga', () => {
  test('visual: gallery closed in window · video max 45s', () => {
    expect(LOCAL_CONFIG.visual.GALLERY_IN_WINDOW).toBe(false);
    expect(LOCAL_CONFIG.visual.FILTERS_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.visual.AVATAR_GALLERY_ALLOWED).toBe(true);
    expect(LOCAL_CONFIG.video.MAX_S).toBe(45);
  });

  test('stamp label includes title · venue · day', () => {
    const captured = new Date(2026, 6, 12); // local 12 Tem
    expect(formatStampDay(captured)).toBe('12 Tem');
    const label = buildStampLabel(
      { title: 'NBA GOAT', location_name: 'Cardak' },
      captured
    );
    expect(label).toBe('NBA GOAT · Cardak · 12 Tem');
  });

  test('gallery capture_source rejected', () => {
    expect(assertCameraCaptureSource({ capture_source: 'gallery' }, LOCAL_CONFIG.visual)).toBe(
      'gallery_forbidden_in_window'
    );
    expect(assertCameraCaptureSource({ from_gallery: true }, LOCAL_CONFIG.visual)).toBe(
      'gallery_forbidden_in_window'
    );
    expect(assertCameraCaptureSource({ capture_source: 'camera' }, LOCAL_CONFIG.visual)).toBeNull();
    expect(assertCameraCaptureSource({}, LOCAL_CONFIG.visual)).toBeNull();
  });

  test('WaitingRoom does not call launchImageLibrary', () => {
    const src = readFileSync(join(root, 'mobile/src/screens/WaitingRoomScreen.js'), 'utf8');
    expect(src).not.toMatch(/launchImageLibrary/);
    expect(src).toMatch(/captureInAppMedia/);
  });

  test('LiveRitual uses in-app camera helper', () => {
    const src = readFileSync(join(root, 'mobile/src/screens/LiveRitualScreen.js'), 'utf8');
    expect(src).toMatch(/captureInAppMedia/);
    expect(src).not.toMatch(/launchImageLibrary/);
  });

  test('memories PATCH rejects stamp mutation keys', () => {
    const src = readFileSync(join(__dirname, '../api/memories.js'), 'utf8');
    expect(src).toMatch(/stamp_immutable/);
    expect(src).toMatch(/buildStampLabel/);
  });

  test('§3 müzik: kapak üzerine oynama/progress yok · attribution string tablosu', () => {
    expect(LOCAL_CONFIG.stubs.MUSIC_SDK_ENABLED).toBe(false);
    const pulse = readFileSync(
      join(root, 'mobile/src/components/PulseExactAllContent.js'),
      'utf8'
    );
    expect(pulse).not.toMatch(/spotifyTrackProgressFill/);
    expect(pulse).not.toMatch(/audioStoryProgressFill/);
    expect(pulse).toContain("t('music_attr_spotify'");
    const card = readFileSync(join(root, 'mobile/src/components/MemoryCard.js'), 'utf8');
    expect(card).toMatch(/Linking\.openURL/);
    expect(card).not.toMatch(/progressFill|ProgressFill/);
  });
});
