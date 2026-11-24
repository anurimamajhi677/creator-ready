// Public YouTube Partner Program rules.
// Source: YouTube Help "YouTube Partner Program overview & eligibility"
// (support.google.com/youtube/answer/72851) and "YouTube channel monetization
// policies" (support.google.com/youtube/answer/1311392). Checked 2026-11-24.
// Only public information belongs in this file.

export const ELIGIBILITY = {
  subscribers: 1000,
  watchHours: 4000, // public long-form watch hours, last 12 months
  shortsViews: 10_000_000, // valid public Shorts views, last 90 days
};

export const REVIEW = {
  appealDays: 21, // appeal window after a rejection
  reapplyDays: 30, // first rejection
  reapplyDaysRepeat: 90, // rejected again
};

// Title words that often mean re-uploaded or compiled content.
export const COMPILATION_WORDS = [
  'compilation', 'best moments', 'best of', 'funny clips', 'funniest',
  'top moments', 'try not to laugh', 'no copyright', 'full movie',
  'full episode', 'whatsapp status', 'status video', 'viral clips',
];

// Title words that point at another platform (likely scraped content).
export const OTHER_PLATFORM_WORDS = [
  'tiktok', 'tik tok', 'reels', 'instagram', 'insta reels', 'snapchat',
  'douyin', 'kwai', 'likee', 'moj', 'josh app', 'facebook video',
];

// Social sites that can prove a creator owns their content.
export const SOCIAL_PATTERNS = [
  ['Instagram', /instagram\.com\//i], ['TikTok', /tiktok\.com\//i],
  ['Facebook', /(?:facebook|fb)\.com\//i], ['X', /(?:^|[^a-z])(?:x|twitter)\.com\//i],
  ['Threads', /threads\.(?:net|com)\//i], ['Twitch', /twitch\.tv\//i],
  ['Snapchat', /snapchat\.com\//i], ['Linktree', /linktr\.ee\//i], ['Heylink', /heylink\.me\//i],
];

// Wording that shows the creator made the content themselves.
export const MADE_BY_PATTERNS = [
  /\bI (?:make|made|create|created|film|filmed|shoot|shot|record|recorded|edit|edited|draw|drew|animate|animated|write|wrote|produce|produced|compose|composed|narrate|narrated)\b/i,
  /\bwe (?:make|made|create|created|film|filmed|record|recorded|edit|edited|produce|produced)\b/i,
  /\b(?:edited|filmed|animated|written|narrated|produced|created|made) by (?:me|us|myself)\b/i,
  /\bmy own (?:videos?|content|music|voice|footage|gameplay)\b/i,
  /\b(?:sources|references|further reading|citations)\s*:/i,
];
