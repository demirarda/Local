/**
 * §3 müzik link-out — metadata + kapak (oEmbed). Ses LOCAL'den akmaz.
 * Platform sırası: Spotify → Apple Music → YouTube (3.).
 */
import { t } from '../i18n/stringTable.js';

const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function detectMusicPlatform(url = '') {
  const u = String(url || '').toLowerCase();
  if (!u) return null;
  if (u.includes('spotify.com') || u.startsWith('spotify:')) return 'spotify';
  if (u.includes('music.apple.com') || u.includes('itunes.apple.com')) return 'apple';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return null;
}

export function musicAttribution(platform, lang = 'tr') {
  if (platform === 'apple') return t('music_attr_apple', lang);
  if (platform === 'youtube') return t('music_attr_youtube', lang);
  if (platform === 'spotify') return t('music_attr_spotify', lang);
  return t('music_attr_spotify', lang);
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
}

async function fetchJson(url, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSpotify(url) {
  const data = await fetchJson(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
  );
  if (!data) return null;
  return {
    platform: 'spotify',
    title: data.title || 'Spotify',
    cover_url: data.thumbnail_url || null,
    provider: data.provider_name || 'Spotify',
    deep_link: url,
  };
}

async function resolveYoutube(url) {
  const data = await fetchJson(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  );
  if (!data) return null;
  return {
    platform: 'youtube',
    title: data.title || 'YouTube',
    cover_url: data.thumbnail_url || null,
    provider: data.provider_name || 'YouTube',
    deep_link: url,
  };
}

async function resolveApple(url) {
  // Apple Music has no public oEmbed; use iTunes lookup when album/track id present
  const idMatch = String(url).match(/[?&]i=(\d+)/) || String(url).match(/\/id(\d+)/);
  if (idMatch?.[1]) {
    const data = await fetchJson(`https://itunes.apple.com/lookup?id=${idMatch[1]}`);
    const row = data?.results?.[0];
    if (row) {
      return {
        platform: 'apple',
        title: row.trackName || row.collectionName || 'Apple Music',
        cover_url: row.artworkUrl100
          ? String(row.artworkUrl100).replace('100x100bb', '300x300bb')
          : null,
        provider: 'Apple Music',
        deep_link: url,
      };
    }
  }
  return {
    platform: 'apple',
    title: 'Apple Music',
    cover_url: null,
    provider: 'Apple Music',
    deep_link: url,
  };
}

/** Enrich a music URL with title/cover for link-out cards */
export async function resolveMusicLinkMeta(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const cached = cacheGet(raw);
  if (cached) return cached;

  const platform = detectMusicPlatform(raw);
  if (!platform) return null;

  let meta = null;
  if (platform === 'spotify') meta = await resolveSpotify(raw);
  else if (platform === 'youtube') meta = await resolveYoutube(raw);
  else if (platform === 'apple') meta = await resolveApple(raw);

  if (!meta) {
    meta = {
      platform,
      title: platform === 'youtube' ? 'YouTube' : platform === 'apple' ? 'Apple Music' : 'Spotify',
      cover_url: null,
      provider: platform,
      deep_link: raw,
    };
  }

  meta.attribution = musicAttribution(platform);
  meta.playback = 'link_out'; // never stream from LOCAL
  cacheSet(raw, meta);
  return meta;
}

/** Attach music_* fields onto a memory row for API responses */
export async function enrichMemoryMusicFields(memory) {
  if (!memory || typeof memory !== 'object') return memory;
  const url =
    memory.spotify_playlist_url ||
    memory.music_url ||
    memory.external_url ||
    null;
  if (!url) return memory;

  const meta = await resolveMusicLinkMeta(url);
  if (!meta) return memory;

  return {
    ...memory,
    music_url: meta.deep_link,
    music_platform: meta.platform,
    music_title: memory.music_title || meta.title,
    music_cover_url: memory.music_cover_url || meta.cover_url,
    music_provider: meta.provider,
    music_attribution: meta.attribution,
    music_playback: 'link_out',
  };
}

export async function enrichMemoryMusicList(rows = []) {
  return Promise.all(rows.map((row) => enrichMemoryMusicFields(row)));
}

export default {
  detectMusicPlatform,
  resolveMusicLinkMeta,
  enrichMemoryMusicFields,
  enrichMemoryMusicList,
  musicAttribution,
};
