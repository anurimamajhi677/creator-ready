import {
  ELIGIBILITY, REVIEW, COMPILATION_WORDS, OTHER_PLATFORM_WORDS,
  SOCIAL_PATTERNS, MADE_BY_PATTERNS,
} from './rules.js';

const WEIGHT = { high: 3, medium: 2, low: 1 };
const STATUS_VALUE = { pass: 1, warn: 0.5, fail: 0 };
const DAY = 86_400_000;

// Self-check questions. Each answer maps to a status.
export const QUESTIONS = [
  {
    id: 'voice', weight: 'high',
    label: 'Voiceover',
    q: 'Do you speak (voiceover or on camera) through most of each video?',
    options: [
      ['most', 'Yes, I talk through most of the video', 'pass'],
      ['some', 'Only a little, or just an intro/outro', 'warn'],
      ['none', 'No, there is no voice from me', 'fail'],
    ],
    fix: 'Talk through your videos: explain, react and give your opinion. A few seconds at the start or end does not count, and subtitles or plain translation alone do not count either.',
  },
  {
    id: 'presence', weight: 'high',
    label: 'You appear in your videos',
    q: 'Do you appear in most videos (face, hands at work, a mask you always wear, or your own avatar)?',
    options: [
      ['yes', 'Yes, in most videos', 'pass'],
      ['some', 'In some videos', 'warn'],
      ['no', 'No, I never appear', 'fail'],
    ],
    fix: 'Show yourself in your videos: your face, your hands doing the work, or a consistent mask or avatar. Being the same person across videos is a strong sign the content is yours.',
  },
  {
    id: 'reused', weight: 'high',
    label: 'Other people’s content',
    q: 'Do your videos use clips, music or footage made by someone else?',
    options: [
      ['none', 'No, everything is mine', 'pass'],
      ['changed', 'Yes, but I add my own commentary or real editing', 'warn'],
      ['unchanged', 'Yes, mostly without changes', 'fail'],
    ],
    fix: 'Stop uploading other people’s clips as they are. If you use them, add your own commentary, story or real editing (both new visuals and sound) through most of the video. Permission from the owner is not enough.',
  },
  {
    id: 'template', weight: 'high',
    label: 'Template or mass-produced videos',
    q: 'Are many videos made from the same template or AI generator, with only small changes (colours, characters, background)?',
    options: [
      ['no', 'No, each video is different', 'pass'],
      ['some', 'Some of them', 'warn'],
      ['yes', 'Yes, most of them', 'fail'],
    ],
    fix: 'Make each video different in substance: a new story, a new angle, your own opinion. Videos that could be swapped for each other look mass-produced.',
  },
  {
    id: 'slideshow', weight: 'high',
    label: 'Slideshows or scrolling text',
    q: 'Are many of your videos just image slideshows or scrolling text?',
    options: [
      ['no', 'No', 'pass'],
      ['some', 'A few', 'warn'],
      ['yes', 'Yes, many of them', 'fail'],
    ],
    fix: 'Replace slideshow and scrolling-text videos with ones that have your voice, your footage or real editing. Make the remaining ones private.',
  },
  {
    id: 'social', weight: 'medium',
    label: 'Same videos on your social media',
    q: 'Do you post the same videos on Instagram/TikTok/Facebook, with the same username, and does that bio link back to this YouTube channel?',
    options: [
      ['both', 'Yes, same videos and the bio links to my channel', 'pass'],
      ['one', 'Only one of these', 'warn'],
      ['no', 'No', 'fail'],
    ],
    fix: 'Post your videos on your Instagram/TikTok with the same username, and put your YouTube channel link in that bio. This helps show you are the original creator. Never upload videos that show someone else’s watermark.',
  },
  {
    id: 'branding', weight: 'low',
    label: 'Your name or logo',
    q: 'Does your channel name or logo appear in your videos (start, end or corner)?',
    options: [
      ['yes', 'Yes, in my recent videos', 'pass'],
      ['some', 'Sometimes', 'warn'],
      ['no', 'No', 'fail'],
    ],
    fix: 'Add your channel name or logo to your videos, at the start, the end or in a corner. Use the same one every time.',
  },
];

// Which checks matter most for each rejection reason.
const REASON_FOCUS = {
  reused: ['titles', 'reused', 'voice', 'presence', 'social', 'socialLinks', 'madeBy'],
  inauthentic: ['template', 'slideshow', 'topic', 'voice', 'presence'],
};

const lower = (s) => (s || '').toLowerCase();

function flagTitle(title) {
  const t = lower(title);
  const words = [...COMPILATION_WORDS, ...OTHER_PLATFORM_WORDS].filter((w) => t.includes(w));
  if (/#\s*(?:shorts\s*)?#?(?:tiktok|reels)/.test(t)) words.push('tiktok/reels hashtag');
  return words;
}

const STOP = new Set('the a an and or of to in on for with my your is are this that how what why i we you it at from by be not new video videos part ep episode vs shorts short #shorts'.split(' '));

function titleWords(title) {
  return new Set(lower(title).replace(/[^\p{L}\p{N}\s#]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

// ---------- Eligibility ----------

function pct(have, need) {
  if (have == null || Number.isNaN(have)) return null;
  return Math.max(0, Math.min(100, Math.round((have / need) * 100)));
}

export function eligibility(channel, { watchHours, shortsViews } = {}) {
  const subs = channel.hiddenSubscribers ? null : channel.subscribers;
  const subsPct = pct(subs, ELIGIBILITY.subscribers);
  const hoursPct = pct(watchHours, ELIGIBILITY.watchHours);
  const shortsPct = pct(shortsViews, ELIGIBILITY.shortsViews);

  const path = (other) => (subsPct == null || other == null ? null : Math.round((subsPct + other) / 2));
  const longPath = path(hoursPct);
  const shortsPath = path(shortsPct);

  const shortsShare = channel.videos.length
    ? channel.videos.filter((v) => v.durationSec > 0 && v.durationSec <= 180).length / channel.videos.length
    : 0;

  let best = 'long';
  if (longPath != null && shortsPath != null) best = shortsPath > longPath ? 'shorts' : 'long';
  else if (shortsPath != null) best = 'shorts';
  else if (longPath == null && shortsShare > 0.5) best = 'shorts';

  const percent = best === 'shorts' ? shortsPath : longPath;
  const eligible = subs != null && subs >= ELIGIBILITY.subscribers &&
    ((watchHours ?? 0) >= ELIGIBILITY.watchHours || (shortsViews ?? 0) >= ELIGIBILITY.shortsViews);

  return {
    subs, subsPct, watchHours: watchHours ?? null, hoursPct, shortsViews: shortsViews ?? null, shortsPct,
    longPath, shortsPath, best, percent: eligible ? 100 : percent, eligible, shortsShare,
  };
}

// ---------- Automatic checks from public channel data ----------

export function autoChecks(channel) {
  const vids = channel.videos.slice(0, 20);
  const totalViews = vids.reduce((s, v) => s + (v.views || 0), 0) || 1;
  const checks = [];

  // 1. Compilation / other-platform titles
  const flagged = vids.map((v) => ({ ...v, flags: flagTitle(v.title) })).filter((v) => v.flags.length);
  const flaggedShare = flagged.reduce((s, v) => s + (v.views || 0), 0) / totalViews;
  checks.push({
    id: 'titles', source: 'auto', weight: 'high',
    label: 'No compilation or re-upload videos',
    status: !vids.length ? 'unknown' : flagged.length === 0 ? 'pass'
      : flagged.length >= 5 || flaggedShare >= 0.3 ? 'fail' : 'warn',
    detail: !vids.length ? 'We could not read your recent videos.'
      : flagged.length === 0 ? `None of your ${vids.length} most-viewed recent videos look like compilations or re-uploads.`
      : `${flagged.length} of your ${vids.length} recent videos have titles that look like compilations or re-uploads (${Math.round(flaggedShare * 100)}% of their views).`,
    videos: flagged.map((v) => ({ id: v.id, title: v.title, flags: v.flags, views: v.views })),
    fix: 'Make these videos private or delete them, starting with the ones that get the most views. Compilations, clips from other platforms and re-uploads are the most common reason for a “reused content” rejection.',
  });

  // 2. Social links
  const text = [channel.description, ...(channel.links || []), ...vids.slice(0, 5).map((v) => v.description)].join('\n');
  const socials = SOCIAL_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
  checks.push({
    id: 'socialLinks', source: 'auto', weight: 'medium',
    label: 'Social media links on your channel',
    status: socials.length ? 'pass' : 'fail',
    detail: socials.length
      ? `Found links to: ${[...new Set(socials)].join(', ')}.`
      : 'No Instagram, TikTok, Facebook or other social links found in your channel description or recent video descriptions.',
    fix: 'Add your Instagram/TikTok/Facebook links to your channel description and video descriptions. Make sure those accounts link back to this YouTube channel.',
  });

  // 3. "I made / edited / filmed" wording
  const madeBy = MADE_BY_PATTERNS.some((re) => re.test(text));
  checks.push({
    id: 'madeBy', source: 'auto', weight: 'medium',
    label: 'You say you make the videos',
    status: madeBy ? 'pass' : 'warn',
    detail: madeBy
      ? 'Your channel or video descriptions say that you make, film or edit the content.'
      : 'Your channel and recent video descriptions don’t say who makes the videos.',
    fix: 'Say clearly in your channel description that you make the videos, for example: “I film, edit and narrate every video on this channel.” Only write it if it is true.',
  });

  // 4. Consistent topic (shared title words among the newest uploads)
  const recent = [...channel.videos].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 10);
  const counts = new Map();
  recent.forEach((v) => titleWords(v.title).forEach((w) => counts.set(w, (counts.get(w) || 0) + 1)));
  const common = [...counts.entries()].filter(([, n]) => n >= Math.max(2, Math.ceil(recent.length * 0.3))).sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 5);
  checks.push({
    id: 'topic', source: 'auto', weight: 'medium',
    label: 'Consistent topic',
    status: recent.length < 3 ? 'unknown' : common.length ? 'pass' : 'warn',
    detail: recent.length < 3 ? 'Not enough recent uploads to tell.'
      : common.length ? `Your recent titles share a clear theme: ${common.join(', ')}.`
      : 'Your recent video titles don’t share a clear topic.',
    fix: 'Stick to one main topic or format so viewers (and reviewers) can see it’s the same creator every time.',
  });

  // 5. Active uploading
  const ninety = Date.now() - 90 * DAY;
  const recentCount = channel.videos.filter((v) => new Date(v.publishedAt).getTime() >= ninety).length;
  checks.push({
    id: 'active', source: 'auto', weight: 'low',
    label: 'Uploading regularly',
    status: recentCount >= 3 ? 'pass' : recentCount >= 1 ? 'warn' : 'fail',
    detail: `${recentCount} public upload${recentCount === 1 ? '' : 's'} in the last 90 days.`,
    fix: 'Keep uploading original videos regularly. New, clearly original videos also change what reviewers see first.',
  });

  return checks;
}

// ---------- Self-check answers ----------

export function selfChecks(answers = {}) {
  return QUESTIONS.map((q) => {
    const opt = q.options.find(([v]) => v === answers[q.id]);
    return {
      id: q.id, source: 'self', weight: q.weight, label: q.label,
      status: opt ? opt[2] : 'unknown',
      detail: opt ? `You answered: ${opt[1]}.` : 'Not answered.',
      fix: q.fix,
    };
  });
}

// ---------- Reapply countdown ----------

export function reapplyInfo(rejection, now = Date.now()) {
  if (!rejection?.date) return null;
  // Work in UTC so the calendar date never shifts with the user's timezone.
  const d = new Date(rejection.date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const wait = rejection.repeat ? REVIEW.reapplyDaysRepeat : REVIEW.reapplyDays;
  const reapply = new Date(d.getTime() + wait * DAY);
  const appeal = new Date(d.getTime() + REVIEW.appealDays * DAY);
  const daysLeft = (t) => Math.max(0, Math.ceil((t.getTime() - now) / DAY));
  return {
    wait,
    reapplyDate: reapply.toISOString().slice(0, 10),
    reapplyDaysLeft: daysLeft(reapply),
    appealDate: appeal.toISOString().slice(0, 10),
    appealDaysLeft: daysLeft(appeal),
    appealOpen: appeal.getTime() > now,
  };
}

// ---------- Put it together ----------

export function analyze(channel, input = {}) {
  const elig = eligibility(channel, input);
  const focus = REASON_FOCUS[input.rejection?.reason] || [];
  const checks = [...autoChecks(channel), ...selfChecks(input.answers)].map((c) => ({
    ...c, focus: focus.includes(c.id),
  }));

  let got = 0, max = 0;
  for (const c of checks) {
    if (c.status === 'unknown') continue;
    const w = WEIGHT[c.weight] * (c.focus ? 1.5 : 1);
    max += w;
    got += w * STATUS_VALUE[c.status];
  }
  const readiness = max ? Math.round((got / max) * 100) : null;

  const fixPlan = checks
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .sort((a, b) =>
      (b.focus - a.focus) ||
      (WEIGHT[b.weight] - WEIGHT[a.weight]) ||
      ((a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1)));

  return {
    channel: { id: channel.id, title: channel.title, handle: channel.handle, thumbnail: channel.thumbnail },
    eligibility: elig,
    checks,
    readiness,
    fixPlan,
    reapply: reapplyInfo(input.rejection),
    checkedAt: new Date().toISOString(),
  };
}
