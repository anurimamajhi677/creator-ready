import { fetchChannel, InputError } from '../_lib/youtube.js';

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

// GET /api/channel?url=<channel link>
export async function onRequestGet({ request, env }) {
  if (!env.YOUTUBE_API_KEY) return json({ error: 'not_configured' }, 503);
  const raw = new URL(request.url).searchParams.get('url') || '';
  if (raw.length > 300) return json({ error: 'That link is too long.' }, 400);
  try {
    const channel = await fetchChannel(raw, env.YOUTUBE_API_KEY);
    return json(channel, 200, { 'cache-control': 'public, max-age=900' });
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'We couldn’t reach YouTube right now. Please try again in a minute.' }, 502);
  }
}
