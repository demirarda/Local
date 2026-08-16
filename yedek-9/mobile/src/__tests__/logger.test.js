/**
 * Unit tests for logger utility
 */
import { log, warn, error } from '../utils/logger';

describe('logger', () => {
  const originalConsole = global.console;

  beforeEach(() => {
    global.console = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    global.__DEV__ = true;
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  it('log calls console.log in __DEV__', () => {
    log('test message');
    expect(console.log).toHaveBeenCalledWith('test message');
  });

  it('warn calls console.warn in __DEV__', () => {
    warn('warning');
    expect(console.warn).toHaveBeenCalledWith('warning');
  });

  it('error always calls console.error', () => {
    error('error msg');
    expect(console.error).toHaveBeenCalledWith('error msg');
  });
});
