/**
 * Logger utility - only outputs log/warn in development.
 * Errors are always logged for debugging.
 */
export const log = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const warn = (...args) => {
  if (__DEV__) {
    console.warn(...args);
  }
};

export const error = (...args) => {
  console.error(...args);
};
