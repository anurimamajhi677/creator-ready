# CreatorReady

Free monetization readiness check for small and rejected YouTube creators.
Paste a channel link → see eligibility progress, an originality/readiness score,
a prioritized fix plan, and (if rejected) the reapply and appeal countdown.

Not affiliated with YouTube or Google. Rules come only from YouTube's **public**
help pages (see `src/lib/rules.js`).

## How it's built

| Part | Where |
|---|---|
| Pages (static, Astro) | `src/pages/` – `index.astro` start page, `check.astro` check + results |
| Scoring and fix plan | `src/lib/analyze.js` (rules in `src/lib/rules.js`) |
| Browser logic, saved progress | `src/scripts/check.js` (localStorage) |
| YouTube data (server, hides API key) | `functions/api/channel.js`, `functions/_lib/youtube.js` |
| Progress links (server, Cloudflare KV) | `functions/api/progress.js` |
| Sample channel for local preview | `src/lib/demo.js` |

Without the server (local `npm run dev`) or without an API key, the check page
uses the sample channel and shows a "Preview mode" banner.

## Commands

```bash
npm install
npm run dev     # local preview at http://localhost:4321 (sample channel)
npm test        # scoring tests
npm run build   # static site in dist/
```

Full local test with the real YouTube API: copy `.dev.vars.example` to `.dev.vars`,
add your key, then `npm run build && npx wrangler pages dev dist`.

## Deploying (Cloudflare Pages)

1. Connect this GitHub repo in Cloudflare Pages. Build command `npm run build`, output `dist`.
2. Add the secret `YOUTUBE_API_KEY` (YouTube Data API v3 key from Google Cloud Console).
3. Create a KV namespace and bind it as `PROGRESS` (see `wrangler.toml`).

## Still to do

- About, Privacy Policy and Contact pages (needed for AdSense)
- Guides (SEO content) and AdSense placement
- Cookie consent for EU visitors
- More languages
