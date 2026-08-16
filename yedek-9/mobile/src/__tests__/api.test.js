/**
 * Unit tests for api utilities
 */
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('api', () => {
  it('getApiBaseUrl returns valid URL for iOS', () => {
    const { getApiBaseUrl } = require('../services/api');
    const url = getApiBaseUrl();
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('/api');
  });

  it('setAuthToken does not throw', () => {
    const { setAuthToken } = require('../services/api');
    expect(() => setAuthToken('test-token')).not.toThrow();
    expect(() => setAuthToken(null)).not.toThrow();
  });
});
