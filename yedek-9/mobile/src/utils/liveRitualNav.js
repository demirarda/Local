import useThemeStore from '../store/themeStore';

export function getLiveRitualRouteName() {
  return useThemeStore.getState().mode === 'dark' ? 'LiveRitualDark' : 'LiveRitual';
}

export function navigateToLiveRitual(navigation, params = {}) {
  if (!navigation?.navigate) return;
  navigation.navigate(getLiveRitualRouteName(), params);
}

export function replaceWithLiveRitual(navigation, params = {}) {
  if (!navigation?.replace) return;
  navigation.replace(getLiveRitualRouteName(), params);
}
