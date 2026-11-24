// Reads public channel data from the YouTube Data API v3.
// Runs on the server only, so the API key is never sent to the browser.

const API = 'https://www.googleapis.com/youtube/v3/';

export class InputError extends Error {}

// Accepts: @handle, youtube.com/@handle, /channel/UC..., /user/name, /c/name,
// a video or Shorts link, or a bare channel ID.
export function parseChannelInput(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new InputError('Paste your channel link.');
  if (/^@[\w.-]{3,}$/.test(s)) return { type: 'handle', value: s };
  if (/^UC[\w-]{22}$/.test(s)) return { type: 'id', value: s };

  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); }
  catch { throw new InputError('That doesn’t look like a YouTube link.'); }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return { type: 'video', value: url.pathname.slice(1, 12) };
  if (host !== 'youtube.com') throw new InputError('That doesn’t look like a YouTube link.');

  const parts = url.pathname.split('/').filter(Boolean);
  const [a, b] = parts;
  if (a?.startsWith('@')) return { type: 'handle', value: decodeURIComponent(a) };
  if (a === 'channel' && b) return { type: 'id', value: b };
  if (a === 'user' && b) return { type: 'user', value: b };
  if (a === 'c' && b) return { type: 'custom', value: decodeURIComponent(b) };
  if ((a === 'shorts' || a === 'live') && b) return { type: 'video', value: b };
  if (a === 'watch' && url.searchParams.get('v')) return { type: 'video', value: url.searchParams.get('v') };
  if (a && parts.length === 1) return { type: 'custom', value: decodeURIComponent(a) };
  throw new InputError('Paste a channel link like youtube.com/@yourname.');
}

async function yt(path, params, key) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason || res.status;
    throw new Error('YouTube API error: ' + reason);
  }
  return res.json();
}

function isoDurationToSec(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

async function resolveChannelId(input, key) {
  if (input.type === 'id') return { id: input.value };
  if (input.type === 'handle') return { forHandle: input.value };
  if (input.type === 'user') return { forUsername: input.value };
  if (input.type === 'video') {
    const r = await yt('videos', { part: 'snippet', id: input.value }, key);
    const id = r.items?.[0]?.snippet?.channelId;
    if (!id) throw new InputError('We couldn’t find that video.');
    return { id };
  }
  // Legacy /c/ names have no direct lookup; search is the fallback.
  const r = await yt('search', { part: 'snippet', type: 'channel', q: input.value, maxResults: '1' }, key);
  const id = r.items?.[0]?.snippet?.channelId;
  if (!id) throw new InputError('We couldn’t find that channel.');
  return { id };
}

export async function fetchChannel(raw, key) {
  const input = parseChannelInput(raw);
  const lookup = await resolveChannelId(input, key);
  const ch = await yt('channels', { part: 'snippet,statistics,contentDetails', ...lookup }, key);
  const c = ch.items?.[0];
  if (!c) throw new InputError('We couldn’t find that channel.');

  const uploads = c.contentDetails?.relatedPlaylists?.uploads;
  let videos = [];
  if (uploads) {
    const pl = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50' }, key).catch(() => ({ items: [] }));
    const ids = (pl.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
    if (ids.length) {
      const vr = await yt('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(','), maxResults: '50' }, key);
      videos = (vr.items || []).map((v) => ({
        id: v.id,
        title: v.snippet.title,
        description: (v.snippet.description || '').slice(0, 2000),
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
        views: Number(v.statistics?.viewCount || 0),
        durationSec: isoDurationToSec(v.contentDetails?.duration),
      }));
    }
  }
  // Most-viewed first: the videos people actually watch matter most in a review.
  videos.sort((a, b) => b.views - a.views);

  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl || '',
    description: c.snippet.description || '',
    thumbnail: c.snippet.thumbnails?.default?.url || '',
    country: c.snippet.country || '',
    subscribers: Number(c.statistics?.subscriberCount || 0),
    hiddenSubscribers: Boolean(c.statistics?.hiddenSubscriberCount),
    videoCount: Number(c.statistics?.videoCount || 0),
    videos,
  };
}
