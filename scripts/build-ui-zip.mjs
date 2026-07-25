// Builds the production Angular browser bundle and packages it as the
// offline-mode UI artefact: dist/studio-ui.zip (the browser bundle's
// CONTENTS at the zip root, so index.html sits alongside assets/ rather
// than nested under a folder) plus dist/studio-ui.manifest.json describing
// its version, checksum, and UI<->server wire-contract number.
//
// This pairing is a packaging CONTRACT consumed by a separate CLI (the
// offline-mode downloader/installer) — the zip layout, manifest filename,
// and manifest shape below must not change without updating that consumer.
//
// Usage: pnpm build:ui-zip
//
// Dependency-free apart from `archiver` (a well-known, pure-JS zip writer —
// used instead of shelling out to a system `zip` binary, which is not
// guaranteed to exist on every CI/dev platform).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// archiver@8's ESM entry point exports the format-specific classes directly
// (no more `archiver('zip', options)` factory from the classic <7.x API).
import { ZipArchive } from 'archiver';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Angular application-builder browser output directory — see angular.json's
 * `outputPath` ("dist/chatwright-studio-prototype"). The `@angular/build:application`
 * builder splits its output into browser/ (and, for SSR, server/); we only
 * ever want the browser/ contents for a static offline bundle.
 */
const BROWSER_DIST_DIR = join(repoRoot, 'dist', 'chatwright-studio-prototype', 'browser');
const DIST_DIR = join(repoRoot, 'dist');
const ZIP_PATH = join(DIST_DIR, 'studio-ui.zip');
const MANIFEST_PATH = join(DIST_DIR, 'studio-ui.manifest.json');

/** UI<->server compatibility contract version. Bump only on a breaking wire change. */
const UI_CONTRACT_VERSION = 1;

/** A fixed epoch-ish timestamp stamped on every zip entry so identical
 * source produces a byte-identical archive run to run (zip entries embed a
 * per-file mtime, which would otherwise vary with the local build clock). */
const DETERMINISTIC_ENTRY_DATE = new Date('2020-01-01T00:00:00Z');

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
}

/** Recursively collects files under `root`, returning `{ full, rel }` pairs
 * sorted by POSIX-style relative path so the zip's entry order — and thus
 * its bytes — is independent of host filesystem directory-iteration order. */
function collectFilesSorted(root) {
  const files = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };
  walk(root);

  return files
    .map((full) => ({ full, rel: relative(root, full).split(sep).join('/') }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** Zips the CONTENTS of `sourceDir` (not the folder itself) into `destZipPath`. */
async function zipDirectoryContents(sourceDir, destZipPath) {
  if (existsSync(destZipPath)) {
    rmSync(destZipPath);
  }

  const files = collectFilesSorted(sourceDir);
  if (files.length === 0) {
    throw new Error(`build-ui-zip: no files found under ${sourceDir} — did the Angular build succeed?`);
  }

  await new Promise((resolvePromise, reject) => {
    const output = createWriteStream(destZipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolvePromise());
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn(err.message);
      } else {
        reject(err);
      }
    });
    archive.on('error', reject);

    archive.pipe(output);
    for (const { full, rel } of files) {
      // Pass each entry's full content as an in-memory Buffer (rather than
      // `archive.file()`, which streams straight off disk) so the deflate
      // compressor always sees the same input in one write — streaming
      // introduces chunk-boundary jitter that made otherwise-identical
      // rebuilds produce byte-different (though content-identical) zips.
      archive.append(readFileSync(full), { name: rel, date: DETERMINISTIC_ENTRY_DATE });
    }
    archive.finalize();
  });
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/** Short git SHA of HEAD, falling back to $GITHUB_SHA (e.g. a shallow CI
 * checkout where `git rev-parse` may not resolve) and finally "unknown". */
function shortGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot }).toString().trim();
  } catch {
    const fromEnv = process.env.GITHUB_SHA;
    return fromEnv ? fromEnv.slice(0, 7) : 'unknown';
  }
}

async function main() {
  // 1. Regenerate the two build-time inputs `ng build` needs (untracked by
  //    design — see .gitignore): the PrimeUI licence stub and the vendored
  //    @chatwright/runtime source. Same two steps as the `prepare:config`
  //    package.json script, run directly here for a self-contained pipeline.
  run(process.execPath, [join(repoRoot, 'scripts', 'prepare-local-config.mjs')]);
  run(process.execPath, [join(repoRoot, 'scripts', 'vendor-runtime.mjs')]);

  // 2. Production build. Deliberately no --base-href override (unlike
  //    build:cloudflare's /studio/): the offline zip is unpacked and served
  //    from its own root by the consuming CLI, so the default "/" applies.
  run(join(repoRoot, 'node_modules', '.bin', 'ng'), ['build', '--configuration', 'production']);

  if (!existsSync(BROWSER_DIST_DIR)) {
    throw new Error(
      `build-ui-zip: expected browser output at ${BROWSER_DIST_DIR} — check angular.json's "outputPath"`
    );
  }

  mkdirSync(DIST_DIR, { recursive: true });

  // 3. Zip the browser output's CONTENTS so index.html lands at the zip root.
  await zipDirectoryContents(BROWSER_DIST_DIR, ZIP_PATH);

  // 4. Checksum + manifest, per the packaging contract.
  const sha256 = sha256File(ZIP_PATH);
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const version = `${pkg.version}-${shortGitSha()}`;

  const manifest = { version, sha256, uiContract: UI_CONTRACT_VERSION };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('');
  console.log(`studio-ui.zip:      ${ZIP_PATH}`);
  console.log(`studio-ui.manifest: ${MANIFEST_PATH}`);
  console.log(`  version:    ${version}`);
  console.log(`  sha256:     ${sha256}`);
  console.log(`  uiContract: ${UI_CONTRACT_VERSION}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
