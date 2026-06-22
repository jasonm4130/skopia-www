# skopia-www

The marketing site for **[Skopia](https://github.com/jasonm4130/skopia)** — privacy-first,
Cloudflare-native web analytics. A static [Astro](https://astro.build) site served at
**skopia.dev** from **Cloudflare Workers Static Assets**.

This is a separate repo from the Skopia product (by design — see the product repo's
`docs/decisions/0007`). It is **not** part of the product's pnpm workspace, so the product's
one-click Deploy button stays single-package.

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:4321 (note: _headers / CSP are NOT applied in `astro dev`)
pnpm build      # static build → ./dist
pnpm check:csp  # CI guard: CSP present, < 2000-char lines, no inline <script> bodies
pnpm preview    # wrangler dev — Cloudflare-accurate preview that DOES apply _headers/CSP
```

## How it's built

- **Static only** — `output: 'static'`, no SSR adapter.
- **Design tokens** (`public/tokens.css`) and **fonts** (`public/fonts/`) are **copied** from
  the product repo (`src/shared/tokens.css` is the source of truth). Edit them there and
  re-copy; don't edit the copies here.
- **CSP** is set in the committed `public/_headers` (Cloudflare honors it for static assets):
  `script-src 'self'` (the calculator/FAQ JS is the external `public/scripts/calculator.js` —
  no inline scripts), `style-src 'self' 'unsafe-inline'` (the design uses inline style
  attributes, which can't be hashed). `pnpm check:csp` enforces this in CI.

## Deploy (maintainer-only)

Needs a Cloudflare account. The Worker is `skopia-marketing`; the apex `skopia.dev` is wired
to it via a Custom Domain. Forkers never deploy this — they only use the product's Deploy
button.

```sh
pnpm wrangler login
pnpm deploy     # build + wrangler deploy
```
