# skopia-www — Skopia marketing site

The marketing site for **Skopia** (privacy-first, Cloudflare-native web analytics) — served
at **skopia.dev**. A **static Astro** site deployed to **Cloudflare Workers Static Assets**
(ADR-0007, in the product repo). Its own repo, its own lockfile — deliberately **not** part
of the product repo's workspace, so the product's one-click Deploy button stays single-package.

## Related repositories

- **`../analytics`** — the Skopia **product** repo (Cloudflare Worker + TypeScript; GitHub:
  `jasonm4130/skopia`). It serves the app/collector at `app.skopia.dev`. The architecture
  decisions that govern this repo live in its `docs/decisions/` (ADRs **0007** marketing
  split, **0008** no build orchestrator, **0009** token sharing). Local cross-repo file access
  is wired via `.claude/settings.local.json` (gitignored).

## Conventions

- **The marketing site has its own design** (the "live system" redesign): palette, type scale and
  motion live in `src/styles/site.css`, and it is no longer a port of the product repo's
  `src/marketing/index.ts`. Lime (`--live`) is reserved for live data on the dark "display"
  panels; keep it off everything else. `public/tokens.css` is still a copy of the product's
  tokens (ADR-0009) but the site no longer links it.
- **Fonts are copied, not authored here.** `public/fonts/` + `public/fonts.css` come from the
  product repo; edit there and re-copy.
- **Generated SVG.** `WorldMap.astro` and `CostChart.astro` are generated markup (dot map, cost
  curve); `public/scripts/site.js` reads their classes and `data-geo`. Regenerate, don't
  hand-edit. Braces in component markup are escaped as `&#123;`/`&#125;` (Astro expressions).
- **Motion rules.** Animate transform/opacity/stroke only; everything renders complete without
  JS or with `prefers-reduced-motion`; the ambient feed pauses when hidden.
- **No SSR adapter.** `output: 'static'` only. Do not add `@astrojs/cloudflare`.
- **CSP is set via `public/_headers`, not Astro's `security.csp`.** Inline style *attributes*
  can't be hashed, so `style-src` uses `'unsafe-inline'`; `script-src 'self'` stays strict
  (all page JS is the external `public/scripts/site.js` — **no inline
  `<script>` bodies**, or CI fails via `pnpm check:csp`).
- **No Turborepo/Nx** (ADR-0008). Plain pnpm.

## Commands

- `pnpm dev` — Astro dev server (note: `_headers`/CSP are NOT applied here).
- `pnpm build` — static build to `./dist`.
- `pnpm check:csp` — CI guard: CSP present, lines < 2000 chars, no inline `<script>` bodies.
- `pnpm preview` — `wrangler dev`, the Cloudflare-accurate preview that **does** apply
  `_headers` (use this to verify CSP).
- `pnpm deploy` — build + `wrangler deploy` (maintainer-only; needs a Cloudflare account).

## Deploy (maintainer-only)

Target: Workers Static Assets, Worker `skopia-marketing` → `skopia.dev`. Forkers never touch
this — they only use the product repo's Deploy button. Custom-domain + Workers Builds wiring
is done once in the Cloudflare dashboard.

**Workers Builds requires the build variable `PNPM_VERSION=11`** (Worker → Settings → Build →
*Variables & Secrets*). The build image defaults to pnpm 10.11.1, which can't read this repo's
pnpm-11 `allowBuilds` approval in `pnpm-workspace.yaml` and fails `pnpm install` without it.
The zone (`www` → apex 301, HSTS, baseline settings) is managed in the `jasonm4130-cf`
Terraform repo, not here.
