import useThemeStore from '../store/themeStore';

export function getLiveRitualRouteName() {
  return 'LiveRitual';
}

export function liveRitualParams(params = {}) {
  const forceDark = useThemeStore.getState().mode === 'dark';
  return forceDark ? { ...params, forceDark: true } : { ...params };
}

export function navigateToLiveRitual(navigation, params = {}) {
  if (!navigation?.navigate) return;
  navigation.navigate(getLiveRitualRouteName(), liveRitualParams(params));
}

export function replaceWithLiveRitual(navigation, params = {}) {
  if (!navigation?.replace) return;
  navigation.replace(getLiveRitualRouteName(), liveRitualParams(params));
}
