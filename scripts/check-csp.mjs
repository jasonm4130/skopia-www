/**
 * CSP guard for the static build. Run after `astro build`.
 *
 * The CSP lives in a committed `public/_headers` (copied to `dist/_headers`) with
 * `script-src 'self'` — no inline scripts allowed. This guard fails the build if:
 *   1. `dist/_headers` is missing or has no Content-Security-Policy line.
 *   2. Any `_headers` line exceeds Cloudflare's 2000-char limit (silently dropped otherwise).
 *   3. Any built HTML contains an inline `<script>` with a body (it would be CSP-blocked at
 *      runtime). Externalise such scripts to `public/scripts/` instead.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const errors = [];

// 1 + 2 — _headers CSP present, line-length guard
let headers;
try {
  headers = readFileSync(join(DIST, '_headers'), 'utf8');
} catch {
  errors.push('dist/_headers not found — run `pnpm build` first.');
}
if (headers) {
  const lines = headers.split('\n');
  if (!lines.some((l) => /content-security-policy:/i.test(l))) {
    errors.push('No Content-Security-Policy line in dist/_headers.');
  }
  const tooLong = lines.filter((l) => l.length > 2000);
  if (tooLong.length) {
    errors.push(`${tooLong.length} line(s) in dist/_headers exceed Cloudflare's 2000-char limit.`);
  }
}

// 3 — no inline <script> bodies in built HTML
function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2].trim();
    const isJsonLd = /type\s*=\s*["']application\/ld\+json["']/i.test(attrs);
    if (!/\bsrc\s*=/.test(attrs) && body.length > 0 && !isJsonLd) {
      errors.push(`${file}: inline <script> with a body — CSP script-src 'self' would block it. Externalise to /scripts/.`);
    }
  }
}

if (errors.length) {
  console.error('CSP check FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `CSP check OK: dist/_headers has a CSP, all lines < 2000 chars, no inline <script> bodies across ${htmlFiles.length} HTML file(s).`,
);
