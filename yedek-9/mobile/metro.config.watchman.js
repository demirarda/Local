// Metro config that FORCES Watchman and disables NodeWatcher
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Only watch src directory - ensure it's a string array
const srcPath = path.resolve(__dirname, 'src');
config.watchFolders = Array.isArray(config.watchFolders) 
  ? [...config.watchFolders, srcPath].filter(Boolean)
  : [srcPath].filter(Boolean);

// Minimal watcher config - Metro will prefer Watchman
config.watcher = {
  watchman: {
    deferStates: ['hg.update'],
  },
  healthCheck: {
    enabled: false,
  },
};

// Aggressive block list
config.resolver = {
  ...config.resolver,
  blockList: [
    /node_modules\/.*\/node_modules\/.*/,
    /.*\/\.git\/.*/,
    /.*\/\.expo\/.*/,
    /.*\/\.expo-shared\/.*/,
    /.*\/ios\/.*/,
    /.*\/android\/.*/,
    /.*\/build\/.*/,
    /.*\/dist\/.*/,
  ],
};

module.exports = config;
