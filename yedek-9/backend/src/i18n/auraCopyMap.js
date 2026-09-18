/**
 * §12 Aura copy-map (Nida): chip cümlesi → kimlik kelimesi.
 * "ekip ilgiliydi" → "ilgili ekip". Yargı yok — gözlem de kimliktir.
 */
import { t } from './stringTable.js';

export const AURA_IDENTITY_MAP = {
  rq_g_1: 'sohbetli',
  rq_g_2: 'dengeli',
  rq_g_3: 'tekrar-gelinen',
  rq_y_1: 'yavaş-ısınan',
  rq_y_2: 'dağınık-masa',
  rq_y_3: 'tanımdan-farklı',
  rq_r_1: 'tanım-kayması',
  rq_r_2: 'tek-ses',
  rq_r_3: 'kadro-uyumsuz',
  p2v_g_1: 'masa-hazır',
  p2v_g_2: 'ilgili ekip',
  p2v_g_3: 'zamanında-servis',
  p2v_g_4: 'konuşulur-ortam',
  p2v_g_5: 'koşul-tuttu',
  p2v_y_1: 'geç-servis',
  p2v_y_2: 'gürültülü',
  p2v_y_3: 'dar-masa',
  p2v_y_4: 'kalabalık-mekan',
  p2v_y_5: 'ışık-hava',
  p2v_r_servis: 'ilgisiz-ekip',
  p2v_r_gurultu: 'giriş-değişti',
  p2v_r_temizlik: 'temizlik-zayıf',
  p2v_r_ucret: 'ücret-sürprizi',
  p2v_r_masa: 'rezervasyon-yok',
  p2z_g_1: 'totem-kolay',
  p2z_g_2: 'alan-yeter',
  p2z_g_3: 'oturma-rahat',
  p2z_g_4: 'canlı',
  p2z_g_5: 'işaret-net',
  p2z_y_1: 'totem-zor',
  p2z_y_2: 'oturma-sınırlı',
  p2z_y_3: 'ışık-zayıf',
  p2z_y_4: 'gölge-az',
  p2z_y_5: 'kalabalık-dalga',
  p2z_r_1: 'alan-kullanılamaz',
  p2z_r_marker: 'markersız',
  p2z_r_totem: 'totem-arıza',
  p2z_r_temizlik: 'temizlik-zayıf',
  p2z_r_oturma: 'oturma-işaret',
  p2z_r_guvenlik: 'güvenlik-hissi',
  p2z_r_erisim: 'erişim-engel',
};

/** Fiil/cümle → kısa kimlik (map yoksa TR fallback + basit çeviri). */
export function toIdentityNoun(phrase) {
  const raw = String(phrase || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(.+?)\s+(ilgiliydi|sıcaktı|akıcıydı)$/i);
  if (m) return `${m[2].replace(/ydi$|ydı$|ydu$|ydü$/i, '')} ${m[1]}`.toLowerCase();
  return raw
    .replace(/\s+(dı|di|du|dü|tı|ti|tu|tü)$/i, '')
    .replace(/ydı$|ydi$|ydu$|ydü$/i, '')
    .trim();
}

export function auraWordForChip(chipId, lang = 'tr') {
  const id = String(chipId || '').trim();
  if (!id) return '';
  if (AURA_IDENTITY_MAP[id]) return AURA_IDENTITY_MAP[id];
  return toIdentityNoun(t(id, lang)) || id;
}

export function decorateAuraChip(row, lang = 'tr') {
  const chip_id = row?.chip_id || row?.id;
  const count = Number(row?.c ?? row?.count ?? row?.total ?? 0);
  return {
    chip_id,
    count,
    label: auraWordForChip(chip_id, lang),
  };
}
