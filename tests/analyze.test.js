import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, eligibility, reapplyInfo } from '../src/lib/analyze.js';
import { demoChannel } from '../src/lib/demo.js';
import { parseChannelInput } from '../functions/_lib/youtube.js';

test('eligibility percentages', () => {
  const ch = { ...demoChannel(), subscribers: 500 };
  const e = eligibility(ch, { watchHours: 2000 });
  assert.equal(e.subsPct, 50);
  assert.equal(e.hoursPct, 50);
  assert.equal(e.longPath, 50);
  assert.equal(e.eligible, false);
  assert.equal(eligibility({ ...ch, subscribers: 1200 }, { watchHours: 4100 }).percent, 100);
});

test('hidden subscribers give no subscriber percentage', () => {
  const e = eligibility({ ...demoChannel(), hiddenSubscribers: true }, { watchHours: 100 });
  assert.equal(e.subs, null);
  assert.equal(e.longPath, null);
});

test('demo channel flags compilation titles', () => {
  const r = analyze(demoChannel(), {});
  const titles = r.checks.find((c) => c.id === 'titles');
  assert.equal(titles.status, 'fail');
  assert.ok(titles.videos.length >= 3);
  assert.equal(r.checks.find((c) => c.id === 'socialLinks').status, 'fail');
});

test('good answers raise readiness, rejection reason reorders the plan', () => {
  const bad = analyze(demoChannel(), { answers: { voice: 'none', presence: 'no', reused: 'unchanged' } });
  const good = analyze(demoChannel(), { answers: { voice: 'most', presence: 'yes', reused: 'none', template: 'no', slideshow: 'no', social: 'both', branding: 'yes' } });
  assert.ok(good.readiness > bad.readiness);
  const rej = analyze(demoChannel(), { answers: { branding: 'no' }, rejection: { reason: 'reused', date: '2026-11-01' } });
  assert.equal(rej.fixPlan[0].focus, true);
  assert.equal(rej.fixPlan.at(-1).id === 'branding' || !rej.fixPlan.at(-1).focus, true);
});

test('reapply dates', () => {
  const now = new Date('2026-11-10T12:00:00').getTime();
  const r = reapplyInfo({ date: '2026-11-01' }, now);
  assert.equal(r.reapplyDate, '2026-12-01');
  assert.equal(r.appealOpen, true);
  assert.equal(reapplyInfo({ date: '2026-11-01', repeat: true }, now).wait, 90);
});

test('parses channel links', () => {
  assert.deepEqual(parseChannelInput('youtube.com/@Riya.Cooks'), { type: 'handle', value: '@Riya.Cooks' });
  assert.deepEqual(parseChannelInput('https://www.youtube.com/channel/UC1234567890123456789012'), { type: 'id', value: 'UC1234567890123456789012' });
  assert.deepEqual(parseChannelInput('https://youtu.be/abcdefghijk?si=x'), { type: 'video', value: 'abcdefghijk' });
  assert.deepEqual(parseChannelInput('https://youtube.com/shorts/abcdefghijk'), { type: 'video', value: 'abcdefghijk' });
  assert.throws(() => parseChannelInput('https://instagram.com/x'));
});
