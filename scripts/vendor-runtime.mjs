// Vendors @chatwright/runtime's TypeScript source into .vendor/runtime-ts/src
// so tsconfig's "@chatwright/runtime" path alias (see tsconfig.json) can
// point straight at first-party .ts files — no npm registry publish of the
// package exists yet (chatwright/runtime-ts is a sibling repo, not an npm
// dependency). Dependency-free: Node built-ins only.
//
// Two sources, tried in order:
//
//   1. A local checkout at the fixed path below (the ingredient a Chatwright
//      developer already has cloned) — copied directly, so local runtime-ts
//      iteration is reflected here without a git round trip. This is a
//      developer-machine convenience, not a portable repo-relative lookup:
//      CI and any other machine fall through to the pinned clone below.
//   2. Otherwise, a shallow git fetch of chatwright/runtime-ts at the PINNED
//      commit SHA below. Deliberately NOT `git ls-remote origin main` at
//      build time — that would make every build depend on whatever the
//      remote's default branch happens to be at that instant, silently
//      picking up unreviewed upstream changes. Bump the pin by hand after
//      verifying the new commit still compiles cleanly under this repo's
//      Angular build.
//
// This script must never write into the vendored copy's *source* — if
// something in runtime-ts blocks Angular compilation, that is a finding to
// report upstream (chatwright/runtime-ts), never a local patch here.

import { existsSync, mkdirSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** chatwright/runtime-ts@main as of this vendoring — bump deliberately, never auto-resolved. */
const RUNTIME_TS_PINNED_SHA = '8a6846be2546b83e47cf751286571c7ab960af6a';
const RUNTIME_TS_REPO_URL = 'https://github.com/chatwright/runtime-ts.git';

/** Fixed developer-machine path — not repo-relative, see the module doc comment above. */
const localCheckout = '/Users/alex/projects/chatwright/runtime-ts';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const vendorRoot = join(repoRoot, '.vendor', 'runtime-ts');
const vendorSrc = join(vendorRoot, 'src');

function copyLocalCheckout() {
  console.log(`vendor-runtime: using local checkout at ${localCheckout}`);
  cpSync(join(localCheckout, 'src'), vendorSrc, { recursive: true });
}

function cloneAtPinnedSha() {
  console.log(
    `vendor-runtime: no local checkout at ${localCheckout} — shallow-fetching ${RUNTIME_TS_REPO_URL}@${RUNTIME_TS_PINNED_SHA}`
  );
  const workdir = mkdtempSync(join(tmpdir(), 'chatwright-runtime-ts-'));
  const git = (...args) => execFileSync('git', args, { cwd: workdir, stdio: 'inherit' });
  try {
    git('init', '--quiet');
    git('remote', 'add', 'origin', RUNTIME_TS_REPO_URL);
    git('fetch', '--quiet', '--depth', '1', 'origin', RUNTIME_TS_PINNED_SHA);
    git('checkout', '--quiet', 'FETCH_HEAD', '--', 'src');
    cpSync(join(workdir, 'src'), vendorSrc, { recursive: true });
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(vendorRoot, { recursive: true });

if (existsSync(join(localCheckout, 'src', 'index.ts'))) {
  copyLocalCheckout();
} else {
  cloneAtPinnedSha();
}

if (!existsSync(join(vendorSrc, 'index.ts'))) {
  throw new Error(`vendor-runtime: expected ${join(vendorSrc, 'index.ts')} to exist after vendoring — aborting`);
}

console.log(`vendor-runtime: @chatwright/runtime vendored at ${vendorSrc}`);
