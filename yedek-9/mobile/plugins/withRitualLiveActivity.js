const { withInfoPlist } = require('@expo/config-plugins');

/**
 * son-part.md §8.4 — ActivityKit / Dynamic Island capability flags.
 */
function withRitualLiveActivity(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return config;
  });

  if (!config.ios) config.ios = {};
  config.ios.infoPlist = {
    ...(config.ios.infoPlist || {}),
    NSSupportsLiveActivities: true,
    NSSupportsLiveActivitiesFrequentUpdates: true,
  };

  return config;
}

module.exports = withRitualLiveActivity;
