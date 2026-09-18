/** son-part.md §8.4 — filtre bazlı boş durum metinleri (i18n keys) */

const COPY = {
  'Tümü': {
    title: 'pulse_empty_all_title',
    message: 'pulse_empty_all_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
  'Şimdi Canlı': {
    title: 'pulse_empty_live_title',
    message: 'pulse_empty_live_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
  'Başlamak Üzere': {
    title: 'pulse_empty_starting_title',
    message: 'pulse_empty_starting_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
  'Local World': {
    title: 'pulse_empty_local_world_title',
    message: 'pulse_empty_local_world_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
  Arkadaşlar: {
    title: 'pulse_empty_friends_title',
    message: 'pulse_empty_friends_msg',
    action: 'pulse_empty_action_add_friend',
    route: 'FriendsList',
  },
  FL: {
    title: 'pulse_empty_fl_title',
    message: 'pulse_empty_fl_msg',
    action: null,
    route: null,
  },
  Uni: {
    title: 'pulse_empty_uni_title',
    message: 'pulse_empty_uni_msg',
    action: null,
    route: null,
  },
  Gizli: {
    title: 'pulse_empty_hidden_title',
    message: 'pulse_empty_hidden_msg',
    action: null,
    route: null,
  },
  'Özel Etkinlikler': {
    title: 'pulse_empty_special_title',
    message: 'pulse_empty_special_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
  Yakınımda: {
    title: 'pulse_empty_nearby_title',
    message: 'pulse_empty_nearby_msg',
    action: 'pulse_empty_action_citywide',
    route: null,
  },
  default: {
    title: 'pulse_empty_default_title',
    message: 'pulse_empty_default_msg',
    action: 'nav_city_rhythm',
    route: 'CityRhythm',
  },
};

export function getPulseEmptyCopy(activeFilter = 'Tümü') {
  return COPY[activeFilter] || COPY.default;
}
