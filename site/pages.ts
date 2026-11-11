// Build-time manifest of every chatwright.dev file outside the Studio app.
//
// chatwright.dev is an assets-only Cloudflare Worker (no `main`, so serving
// it costs no Worker invocations): scripts/build-site.mjs bundles this
// module, writes each `sitePages` entry to dist/site/<file>, copies the
// Angular build into dist/site/studio/, and writes `_redirects`/`_headers`
// from the rules below. The page modules are the same string templates the
// former Worker returned at request time, now prerendered byte-for-byte.
import { guidePages } from './guides/page';
import { landingDocument } from './landing';
import { techStackPageDocument } from './about/tech-stack/page';
import { vanityModuleRepos, vanityPageDocument } from './vanity';
import { runBundleV1PageDocument } from './formats/run-bundle/v1/page';
import runBundleV1Schema from './formats/run-bundle/v1/schema.json';
import { chatwrightMdV1PageDocument } from './formats/chatwright-md/v1/page';
import chatwrightMdV1Schema from './formats/chatwright-md/v1/schema.json';
import { quickstartPageDocument } from './quickstart/page';
import { recipesPageDocument } from './recipes/page';
import { pricingPageDocument } from './pricing/page';
import { pricingReturnPageDocument } from './pricing/return-page';
import { billingPageDocument } from './billing/page';
import { badgeSvgDocument } from './badge';
import { tryGithubPageDocument, tryGithubPrefix } from './try-github';

const robotsDocument = `User-agent: *
Allow: /

Sitemap: https://chatwright.dev/sitemap.xml
`;

// Re-serialising the imported schema modules (rather than shipping a second
// copy of the raw text) is safe: encoding/json's Go writer and JSON.stringify
// agree byte-for-byte on these files' key order, two-space indent and
// escaping — see site/formats/*/v1/README.md for the canonical sources and
// how these copies are kept in sync on format releases.
const schemaDocument = (schema: unknown): string => `${JSON.stringify(schema, null, 2)}\n`;

// Paths are relative to the assets directory. With the default html_handling
// (auto-trailing-slash), `pricing.html` answers `/pricing` (`/pricing/` 307s
// to it), `formats/run-bundle/v1.html` answers `/formats/run-bundle/v1`, etc.
export const sitePages: Record<string, string> = {
  'index.html': landingDocument,
  ...guidePages,
  'about/tech-stack/index.html': techStackPageDocument,
  '404.html': notFoundDocument(),
  'robots.txt': robotsDocument,
  'formats/run-bundle/v1.html': runBundleV1PageDocument,
  'formats/run-bundle/v1/schema.json': schemaDocument(runBundleV1Schema),
  'formats/chatwright-md/v1.html': chatwrightMdV1PageDocument,
  'formats/chatwright-md/v1/schema.json': schemaDocument(chatwrightMdV1Schema),
  'quickstart.html': quickstartPageDocument,
  'recipes.html': recipesPageDocument,
  'pricing.html': pricingPageDocument,
  'pricing/return.html': pricingReturnPageDocument,
  'billing.html': billingPageDocument,
  'badge.svg': badgeSvgDocument,
  'try-github.html': tryGithubPageDocument,
  ...Object.fromEntries(
    Object.entries(vanityModuleRepos).map(([root, repo]) => [`go/${root}.html`, vanityPageDocument(root, repo)])
  )
};

// Canonical HTML pages opt in automatically; account, resolver and vanity
// pages already declare noindex. Assets and error pages never enter the sitemap.
export function sitemapDocument(pages: Record<string, string>): string {
  const urls = new Set<string>();
  for (const [file, html] of Object.entries(pages)) {
    if (!file.endsWith('.html') || /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html)) continue;
    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="(https:\/\/chatwright\.dev\/[^"?#]*)"/i)?.[1];
    if (canonical) urls.add(canonical);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].sort().map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
}

sitePages['sitemap.xml'] = sitemapDocument(sitePages);

// The former Worker answered unknown paths with a plain-text "Not found".
function notFoundDocument(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Not found — Chatwright</title>
  </head>
  <body>Not found. <a href="/">chatwright.dev</a></body>
</html>
`;
}

// `_redirects` lines, in order. Exact (static) rules come before splat
// (dynamic) ones — Cloudflare evaluates static rules faster. A 200 is a
// rewrite and is applied before asset lookup, even over an existing file,
// so a rewrite source must never cover a real asset. Targets omit `.html`
// (auto-trailing-slash would otherwise 307 them).
export function redirectRules(): string[] {
  const roots = Object.keys(vanityModuleRepos);
  return [
    // Former Worker: /prototype[/...] → 308 /studio[/...]; /studio → 308 /studio/.
    '/prototype /studio/ 308',
    '/studio /studio/ 308',
    // Unknown Studio paths retain the 404 app shell; known paths are assets.
    // Each known deep link is emitted as its own HTML shell with route metadata.
    // Go vanity import paths: the module roots themselves.
    ...roots.map((root) => `/${root} /go/${root} 200`),
    // Dynamic (splat) rules.
    '/prototype/* /studio/:splat 308',
    `${tryGithubPrefix}* /try-github 200`,
    ...roots.map((root) => `/${root}/* /go/${root} 200`)
  ];
}

// `_headers` file. Everything not listed gets Cloudflare's asset defaults
// (`Cache-Control: public, max-age=0, must-revalidate` plus an ETag).
export const headerRules = `/install.sh
  Content-Type: text/x-shellscript; charset=utf-8
  Cache-Control: public, max-age=300

/install.ps1
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=300

/badge.svg
  Cache-Control: public, max-age=86400
`;

export { studioShell } from './studio-shell';
export { studioDeepLinks } from './studio-deep-links';
