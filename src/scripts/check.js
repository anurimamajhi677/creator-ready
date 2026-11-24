import { analyze, QUESTIONS } from '../lib/analyze.js';
import { demoChannel } from '../lib/demo.js';
import { ELIGIBILITY } from '../lib/rules.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en'));
const niceDate = (iso) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------- Saved in this browser (wrapped: storage can be blocked) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const histKey = (id) => `cr:hist:${id}`;

// ---------- Form helpers ----------
function readForm(form) {
  const f = new FormData(form);
  const num = (k) => { const v = f.get(k); return v === '' || v == null ? undefined : Math.max(0, Number(v)); };
  const answers = {};
  for (const q of QUESTIONS) { const v = f.get(`q_${q.id}`); if (v) answers[q.id] = v; }
  const mode = f.get('mode');
  return {
    mode,
    url: String(f.get('url') || '').trim(),
    watchHours: num('watchHours'),
    shortsViews: num('shortsViews'),
    answers,
    rejection: mode === 'rejected'
      ? { reason: f.get('reason'), date: f.get('rejectedOn') || '', repeat: f.get('repeat') === 'on' }
      : null,
  };
}

function fillForm(form, input) {
  if (!input) return;
  const set = (name, v) => { const el = form.elements[name]; if (el && v != null) el.value = v; };
  if (input.mode) setMode(form, input.mode);
  set('url', input.url);
  set('watchHours', input.watchHours);
  set('shortsViews', input.shortsViews);
  for (const [id, v] of Object.entries(input.answers || {})) {
    const el = form.querySelector(`input[name="q_${id}"][value="${CSS.escape(v)}"]`);
    if (el) el.checked = true;
  }
  if (input.rejection) {
    set('reason', input.rejection.reason);
    set('rejectedOn', input.rejection.date);
    form.elements.repeat.checked = !!input.rejection.repeat;
  }
}

function setMode(form, mode) {
  const radio = form.querySelector(`input[name="mode"][value="${mode === 'rejected' ? 'rejected' : 'progress'}"]`);
  radio.checked = true;
  $('.rejected-only', form).hidden = radio.value !== 'rejected';
  $('.form-title', form).textContent = radio.value === 'rejected' ? 'Find out why, and fix it' : 'How close is your channel?';
}

// ---------- Data ----------
async function getChannel(url) {
  let res;
  try { res = await fetch(`/api/channel?url=${encodeURIComponent(url)}`); }
  catch { throw new Error('No internet connection. Please try again.'); }
  // No server function (local preview) or no API key yet: use the demo channel.
  if (res.status === 404 || res.status === 503 || !(res.headers.get('content-type') || '').includes('json')) {
    return demoChannel();
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------- Rendering ----------
const tone = (p) => (p == null ? '' : p >= 75 ? '' : p >= 45 ? 'warn' : 'fail');

function meter(label, have, need, p) {
  return `<div class="meter"><div class="lbl"><span>${label}</span><span class="muted">${fmt(have)} / ${fmt(need)}</span></div>
    <div class="bar ${tone(p)}"><i style="width:${p ?? 0}%"></i></div></div>`;
}

function readinessWord(r) {
  if (r == null) return 'Answer the self-check to get a score.';
  if (r >= 85) return 'Looks strong. Keep it up.';
  if (r >= 65) return 'Getting there. A few things to fix.';
  if (r >= 40) return 'Needs work before you apply.';
  return 'High risk of rejection right now.';
}

function renderResults(result, input, prev, channel) {
  const e = result.eligibility;
  const ch = result.channel;
  const path = e.best === 'shorts' ? 'Shorts path' : 'Long-video path';
  const missingNumbers = e.best === 'shorts' ? e.shortsViews == null : e.watchHours == null;

  let html = `<div class="card ch">
      ${ch.thumbnail ? `<img src="${esc(ch.thumbnail)}" alt="" />` : ''}
      <div><h2>${esc(ch.title)} ${channel.demo ? '<span class="badge">Sample channel</span>' : ''}</h2>
      <div class="muted">${esc(ch.handle)} · checked ${niceDate(result.checkedAt.slice(0, 10))}</div></div>
    </div>`;

  if (prev) {
    const d = (result.readiness ?? 0) - (prev.readiness ?? 0);
    html += `<div class="delta ${d < 0 ? 'down' : ''}">Last check (${niceDate(prev.at.slice(0, 10))}): readiness ${prev.readiness ?? '—'}% → now ${result.readiness ?? '—'}% ${d > 0 ? '🎉' : ''}</div>`;
  }

  html += `<div class="scores">
    <div class="card score">
      <h3>Eligibility · ${path}</h3>
      <div class="big">${e.percent == null ? '—' : e.percent + '%'}</div>
      ${e.eligible ? '<p>You meet the numbers. You can apply in YouTube Studio → Earn.</p>' : ''}
      ${meter('Subscribers', e.subs, ELIGIBILITY.subscribers, e.subsPct)}
      ${e.best === 'shorts'
        ? meter('Shorts views (90 days)', e.shortsViews, ELIGIBILITY.shortsViews, e.shortsPct)
        : meter('Watch hours (12 months)', e.watchHours, ELIGIBILITY.watchHours, e.hoursPct)}
      ${e.subs == null ? '<p class="note">Your subscriber count is hidden, so we can’t measure it.</p>' : ''}
      ${missingNumbers ? `<p class="note">Add your ${e.best === 'shorts' ? 'Shorts views' : 'watch hours'} from YouTube Studio for a full percentage.</p>` : ''}
    </div>
    <div class="card score">
      <h3>Readiness to ${input.mode === 'rejected' ? 'reapply' : 'apply'}</h3>
      <div class="big">${result.readiness == null ? '—' : result.readiness + '%'}</div>
      <div class="bar ${tone(result.readiness)}"><i style="width:${result.readiness ?? 0}%"></i></div>
      <p>${readinessWord(result.readiness)}</p>
      <p class="note">Based on ${result.checks.filter((c) => c.status !== 'unknown').length} checks of your public videos and your answers.</p>
    </div>
  </div>`;

  const r = result.reapply;
  if (r) {
    html += `<div class="card"><h3>Your timeline</h3><div class="countdown">
      <div><div class="n">${r.reapplyDaysLeft === 0 ? 'Now' : r.reapplyDaysLeft + ' days'}</div>
        <div class="muted">${r.reapplyDaysLeft === 0 ? 'You can reapply' : 'until you can reapply'} (${niceDate(r.reapplyDate)})</div></div>
      <div><div class="n">${r.appealOpen ? r.appealDaysLeft + ' days' : 'Closed'}</div>
        <div class="muted">${r.appealOpen ? `left to appeal (until ${niceDate(r.appealDate)})` : 'Appeal window (21 days) has passed'}</div></div>
    </div><p class="note">YouTube lets you reapply ${r.wait} days after ${r.wait === 90 ? 'a repeat' : 'a'} rejection. Use this time to fix the items below first.</p></div>`;
  } else if (input.mode === 'rejected') {
    html += `<p class="note">Add the date of your rejection email to see when you can reapply.</p>`;
  }

  html += `<div class="card"><h2>Your fix plan</h2>`;
  if (!result.fixPlan.length) {
    html += `<p>Nothing major to fix. 🎉 Keep making original videos${input.mode === 'rejected' ? ' and reapply when your wait is over' : ''}.</p>`;
  } else {
    html += `<p class="muted">Most important first.</p><ol class="fix-list">` + result.fixPlan.map((c) => `
      <li class="fix ${c.status}">
        <h4>${esc(c.label)} <span class="chip ${c.status}">${c.status === 'fail' ? 'Fix this' : 'Improve'}</span>
          ${c.focus ? '<span class="chip focus">Linked to your rejection</span>' : ''}</h4>
        <p class="muted">${esc(c.detail)}</p>
        <p class="todo">👉 ${esc(c.fix)}</p>
        ${c.videos?.length ? `<ul class="vids">${c.videos.slice(0, 8).map((v) => `<li>${channel.demo ? esc(v.title) : `<a href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">${esc(v.title)}</a>`} <span class="muted">· ${fmt(v.views)} views</span></li>`).join('')}</ul>` : ''}
      </li>`).join('') + `</ol>`;
  }
  html += `</div>`;

  const ok = result.checks.filter((c) => c.status === 'pass');
  const unknown = result.checks.filter((c) => c.status === 'unknown');
  html += `<details class="card"><summary>Everything we checked (${ok.length} passed${unknown.length ? `, ${unknown.length} not answered` : ''})</summary>
    <ul class="passed">${result.checks.map((c) => `<li><span class="chip ${c.status}">${{ pass: 'OK', warn: 'Improve', fail: 'Fix', unknown: '?' }[c.status]}</span><span><strong>${esc(c.label)}</strong> <span class="muted">${esc(c.detail)}</span></span></li>`).join('')}</ul></details>`;

  html += `<div class="card"><h3>Track your progress</h3>
    <p class="muted">This browser remembers your result. Come back after fixing things and check again to see your score go up.</p>
    <div class="actions">
      <button class="btn" type="button" id="recheck">Check again</button>
      <button class="btn secondary" type="button" id="save-link">Get a progress link</button>
    </div>
    <div id="save-out" class="save-row" hidden style="margin-top:12px"></div>
    <p class="note">A progress link opens your history on any phone or computer. It stores only your channel, scores and answers. No name, email or password.</p>
  </div>`;

  const box = $('#results');
  box.innerHTML = html;
  box.hidden = false;
}

// ---------- Progress link ----------
async function saveProgressLink(channel) {
  const out = $('#save-out');
  const history = store.get(histKey(channel.id)) || [];
  const linkId = store.get(`cr:link:${channel.id}`);
  out.hidden = false;
  out.innerHTML = '<span class="muted">Saving…</span>';
  try {
    const res = await fetch('/api/progress', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: linkId || undefined, channelId: channel.id, channelTitle: channel.title, history }),
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) throw new Error('offline');
    const { id } = await res.json();
    store.set(`cr:link:${channel.id}`, id);
    const url = `${location.origin}/check?r=${id}`;
    out.innerHTML = `<input type="text" readonly value="${esc(url)}" aria-label="Your progress link" /><button class="btn secondary" type="button" id="copy-link">Copy</button>`;
    $('#copy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(url); $('#copy-link').textContent = 'Copied ✓'; }
      catch { out.querySelector('input').select(); }
    };
  } catch {
    out.innerHTML = '<span class="muted">Progress links will work once the site is live. Your result is still saved in this browser.</span>';
  }
}

async function loadProgressLink(id, form) {
  try {
    const res = await fetch(`/api/progress?id=${encodeURIComponent(id)}`);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) throw new Error();
    const rec = await res.json();
    const last = rec.history.at(-1);
    store.set(histKey(rec.channelId), rec.history);
    store.set(`cr:link:${rec.channelId}`, id);
    fillForm(form, last?.input);
    showBanner(`Welcome back! Progress for <strong>${esc(rec.channelTitle)}</strong>: ${rec.history.length} check${rec.history.length === 1 ? '' : 's'} so far, last readiness ${last?.readiness ?? '—'}%. Update your answers and check again.`);
  } catch {
    showBanner('We couldn’t open that progress link. You can still run a new check.');
  }
}

function showBanner(html) { const b = $('#banner'); b.innerHTML = html; b.hidden = false; }

// ---------- Page ----------
export function initCheckPage() {
  const form = $('#check-form');
  const params = new URLSearchParams(location.search);
  form.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => setMode(form, r.value)));

  const last = store.get('cr:last');
  fillForm(form, last);
  setMode(form, params.get('mode') || last?.mode || 'progress');
  if (params.get('url')) form.elements.url.value = params.get('url');
  if (params.get('r')) loadProgressLink(params.get('r'), form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#form-error');
    err.hidden = true;
    const input = readForm(form);
    if (!input.url) { err.textContent = 'Paste your channel link first.'; err.hidden = false; form.elements.url.focus(); return; }

    const btn = $('#submit-btn');
    btn.disabled = true; btn.textContent = 'Checking your channel…';
    try {
      const channel = await getChannel(input.url);
      const result = analyze(channel, input);
      const history = store.get(histKey(channel.id)) || [];
      const prev = history.at(-1);
      history.push({
        at: result.checkedAt, readiness: result.readiness, eligibility: result.eligibility.percent,
        open: result.fixPlan.map((c) => c.id), input,
      });
      store.set(histKey(channel.id), history.slice(-30));
      store.set('cr:last', input);
      if (channel.demo) showBanner('<strong>Preview mode:</strong> the YouTube connection isn’t set up yet, so this shows a sample channel. Your answers and numbers are still used.');

      renderResults(result, input, prev, channel);
      $('#recheck').onclick = () => { form.scrollIntoView({ behavior: 'smooth' }); };
      $('#save-link').onclick = () => saveProgressLink(channel);
      $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Check my channel';
    }
  });
}
