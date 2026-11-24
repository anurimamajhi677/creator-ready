// Progress links: stores a channel's check history under a random ID, no account.
// Stored: channel ID/title, scores, checklist answers, dates. No names, emails or passwords.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const ID_RE = /^[a-z0-9]{10}$/;
const YEAR = 365 * 24 * 3600;

function newId() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => abc[b % abc.length]).join('');
}

// GET /api/progress?id=xxxx
export async function onRequestGet({ request, env }) {
  if (!env.PROGRESS) return json({ error: 'not_configured' }, 503);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID_RE.test(id)) return json({ error: 'Invalid link.' }, 400);
  const data = await env.PROGRESS.get(id, 'json');
  return data ? json(data) : json({ error: 'This progress link was not found.' }, 404);
}

// POST /api/progress  { id?, channelId, channelTitle, history: [...] }
export async function onRequestPost({ request, env }) {
  if (!env.PROGRESS) return json({ error: 'not_configured' }, 503);
  const text = await request.text();
  if (text.length > 30_000) return json({ error: 'Too much data.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'Bad data.' }, 400); }
  if (typeof body.channelId !== 'string' || !Array.isArray(body.history)) return json({ error: 'Bad data.' }, 400);

  const id = ID_RE.test(body.id || '') ? body.id : newId();
  const record = {
    channelId: body.channelId.slice(0, 40),
    channelTitle: String(body.channelTitle || '').slice(0, 120),
    history: body.history.slice(-30),
    updatedAt: new Date().toISOString(),
  };
  await env.PROGRESS.put(id, JSON.stringify(record), { expirationTtl: YEAR });
  return json({ id });
}
