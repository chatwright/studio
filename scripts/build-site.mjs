// Assembles the static chatwright.dev site into dist/site/ — the assets
// directory of the assets-only `chatwright-dev` Worker (wrangler.jsonc).
//
//   dist/site/                 prerendered pages from site/pages.ts
//   dist/site/studio/          the Angular build (built with --base-href /studio/)
//   dist/site/studio/404.html  copy of the Studio shell (SPA fallback, status 404)
//   dist/site/install.{sh,ps1} the CLI installers from site/install/
//   dist/site/_redirects       from site/pages.ts redirectRules()
//   dist/site/_headers         from site/pages.ts headerRules
//
// Run after `ng build` (see the `build:cloudflare` script). site/pages.ts is
// TypeScript importing JSON, so it is bundled with esbuild to a temporary
// module and imported from there.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const angularBrowserDir = join(repoRoot, 'dist', 'chatwright-studio-prototype', 'browser');
const siteDir = join(repoRoot, 'dist', 'site');
const studioDir = join(siteDir, 'studio');
const renderModule = join(repoRoot, 'dist', '.site-pages.mjs');

if (!existsSync(join(angularBrowserDir, 'index.html'))) {
  throw new Error(`build-site: no Angular build at ${angularBrowserDir} — run \`pnpm build:cloudflare\``);
}

await build({
  entryPoints: [join(repoRoot, 'site', 'pages.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: renderModule,
  logLevel: 'warning'
});
const { sitePages, redirectRules, headerRules } = await import(pathToFileURL(renderModule).href);
rmSync(renderModule);

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

for (const [file, content] of Object.entries(sitePages)) {
  const target = join(siteDir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

const installDir = join(repoRoot, 'site', 'install');
for (const file of readdirSync(installDir)) {
  copyFileSync(join(installDir, file), join(siteDir, file));
}

cpSync(angularBrowserDir, studioDir, { recursive: true });
copyFileSync(join(studioDir, 'index.html'), join(studioDir, '404.html'));

writeFileSync(join(siteDir, '_redirects'), `${redirectRules().join('\n')}\n`);
writeFileSync(join(siteDir, '_headers'), headerRules);

console.log(`build-site: wrote ${Object.keys(sitePages).length} pages + Studio to ${siteDir}`);
