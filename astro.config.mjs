// @ts-check
import { defineConfig } from 'astro/config';

// Static marketing site → Cloudflare Workers Static Assets (ADR-0007).
// No SSR adapter. `output: 'static'` and `outDir: './dist'` are Astro 6 defaults,
// stated explicitly so they can't drift and so `outDir` matches wrangler.jsonc.
//
// NOTE: we deliberately do NOT enable Astro's `security.csp` feature. The landing
// page is built with inline `style="…"` attributes, which CSP style hashes cannot
// cover (only 'unsafe-inline' / 'unsafe-hashes' do). The CSP is set instead via the
// committed `public/_headers` file. See docs/CSP in the product repo plan.
export default defineConfig({
  // Canonical origin — lets BaseLayout build absolute canonical/OG URLs.
  site: 'https://skopia.dev',
  output: 'static',
  outDir: './dist',
});
