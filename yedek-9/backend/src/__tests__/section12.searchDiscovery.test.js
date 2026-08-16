/**
 * §12 search & discovery / brand / web-vitrin / window_visibility
 */
import { describe, it, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { SEARCH_TABS } from '../services/searchService.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { displayWebAuthorName } from '../services/brandService.js';

describe('§12 search discovery', () => {
  it('includes required tabs + brands filter', () => {
    expect(SEARCH_TABS).toEqual(
      expect.arrayContaining([
        'all',
        'rituals',
        'slots',
        'venues',
        'zones',
        'people',
        'memories',
        'category',
        'location',
        'brands',
      ])
    );
  });

  it('brand signature does not affect ranking', () => {
    expect(LOCAL_CONFIG.search.BRAND_SIGNATURE_AFFECTS_RANKING).toBe(false);
  });

  it('WEB_SHOWCASE is stub-closed and still advertises store CTAs', () => {
    expect(LOCAL_CONFIG.stubs.WEB_SHOWCASE_ENABLED).toBe(false);
    const pub = getPublicConfig();
    expect(pub.stubs.web_showcase.enabled).toBe(false);
    expect(pub.stubs.web_showcase.app_store_url).toBeTruthy();
    expect(pub.stubs.web_showcase.play_store_url).toBeTruthy();
    expect(pub.search.window_visibility_default).toBe('CLOSED');
  });

  it('web_named opt-in rumuz', () => {
    expect(displayWebAuthorName({ webNamed: false, name: 'Ayşe', city: 'Kadıköy' })).toBe(
      'bir LOCAL üyesi · Kadıköy'
    );
    expect(displayWebAuthorName({ webNamed: true, name: 'Ayşe', city: 'Kadıköy' })).toBe('Ayşe');
  });

  it('exposes window_visibility options for create toggle', () => {
    const pub = getPublicConfig();
    expect(pub.search.window_visibility_options).toEqual(['CLOSED', 'TRANSPARENT']);
  });
});
