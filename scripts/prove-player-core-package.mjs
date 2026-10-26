#!/usr/bin/env node
/**
 * Packed-consumer proof for @chatwright/player-core.
 *
 * This is an executable receipt, not a mock: it builds and packs the real
 * package, inspects the tarball's manifest/file list/runtime imports, installs
 * that tarball into a fresh temporary consumer *outside* this repository, then
 * proves the published runtime and TypeScript declarations from that install
 * alone. It never aliases the repository source, a sibling checkout or the
 * vendored runtime.
 *
 * Usage: pnpm prove:player-core
 * The temporary work directory is reported and kept for inspection.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageName = '@chatwright/player-core';
const goldenPath = join(repoRoot, 'src/app/player/testdata/golden.chatwright.json');

const steps = [];

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  const step = {
    label,
    command: [command, ...args].join(' '),
    cwd: options.cwd ?? repoRoot,
    exit: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim()
  };
  steps.push(step);
  if (result.status !== 0) {
    const detail = step.stderr || step.stdout || 'no output';
    throw new Error(`${label} failed (exit ${result.status})\n${detail}`);
  }
  return step;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Proof assertion failed: ${message}`);
  }
}

function parseJsonOutput(step, label) {
  try {
    return JSON.parse(step.stdout);
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}\n${step.stdout}`);
  }
}

const workRoot = mkdtempSync(join(tmpdir(), 'chatwright-player-core-proof-'));
const packDir = join(workRoot, 'tarball');
const extractDir = join(workRoot, 'extract');
const consumerDir = join(workRoot, 'consumer');
mkdirSync(packDir, { recursive: true });
mkdirSync(extractDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

try {
  const build = run('build package', 'pnpm', ['--filter', packageName, 'build'], {
    cwd: repoRoot
  });

  const pack = run(
    'pack package',
    'pnpm',
    ['--filter', packageName, 'pack', '--pack-destination', packDir, '--json'],
    { cwd: repoRoot }
  );
  const packJson = parseJsonOutput(pack, 'pack');
  assert(packJson.name === packageName, `packed name ${packJson.name}`);
  assert(typeof packJson.version === 'string', 'packed version is present');
  assert(typeof packJson.filename === 'string', 'packed filename is present');

  const tarball = resolve(packDir, packJson.filename);
  assert(existsSync(tarball), `tarball exists at ${tarball}`);
  const tarballBytes = readFileSync(tarball);
  const tarballSha256 = createHash('sha256').update(tarballBytes).digest('hex');

  const listStep = run('list tarball', 'tar', ['-tzf', tarball]);
  const fileList = listStep.stdout.split('\n').filter(Boolean);

  const manifestStep = run('read packed manifest', 'tar', [
    '-xOzf',
    tarball,
    'package/package.json'
  ]);
  const packedManifest = JSON.parse(manifestStep.stdout);

  assert(packedManifest.name === packageName, 'packed manifest has the package name');
  assert(packedManifest.version === packJson.version, 'packed manifest has the packed version');
  assert(packedManifest.type === 'module', 'packed manifest is ESM');
  assert(packedManifest.main === './dist/index.js', 'packed main points at compiled ESM');
  assert(packedManifest.types === './dist/index.d.ts', 'packed types point at declarations');
  assert(
    packedManifest.exports?.['.']?.types === './dist/index.d.ts',
    'exports map exposes declarations for the root entry point'
  );
  assert(
    packedManifest.exports?.['.']?.import === './dist/index.js',
    'exports map exposes compiled ESM for the root entry point'
  );
  assert(
    packedManifest.exports?.['.']?.default === './dist/index.js',
    'exports map has a default compiled ESM target'
  );

  // Dependency closure: a runtime package with no dependencies at all.
  const dependencyFields = [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
    'bundledDependencies',
    'bundleDependencies'
  ];
  const nonEmptyDependencyFields = dependencyFields.filter((field) => {
    const value = packedManifest[field];
    return Array.isArray(value) ? value.length > 0 : value && Object.keys(value).length > 0;
  });
  assert(
    nonEmptyDependencyFields.length === 0,
    `runtime dependency fields are empty (found ${nonEmptyDependencyFields.join(', ') || 'none'})`
  );

  for (const required of [
    'package/dist/index.js',
    'package/dist/index.d.ts',
    'package/LICENSE',
    'package/NOTICE',
    'package/README.md',
    'package/package.json'
  ]) {
    assert(fileList.includes(required), `tarball contains ${required}`);
  }
  assert(!fileList.some((file) => file.startsWith('package/src/')), 'tarball excludes private source');
  assert(!fileList.some((file) => file.startsWith('package/test/')), 'tarball excludes tests');
  assert(!fileList.some((file) => file.includes('node_modules/')), 'tarball has no node_modules');

  run('extract tarball', 'tar', ['-xzf', tarball, '-C', extractDir]);
  const packedRoot = join(extractDir, 'package');
  const licenceText = readFileSync(join(packedRoot, 'LICENSE'), 'utf8');
  const noticeText = readFileSync(join(packedRoot, 'NOTICE'), 'utf8');
  assert(licenceText.includes('Apache License'), 'packed LICENSE is Apache-2.0');
  assert(noticeText.includes('Copyright 2026 Sneat.co'), 'packed NOTICE carries the project notice');
  const distDir = join(packedRoot, 'dist');
  const distFiles = readdirSync(distDir);

  const externalRuntimeImports = [];
  const externalDeclarationImports = [];
  for (const file of distFiles) {
    const text = readFileSync(join(distDir, file), 'utf8');
    const specifiers = [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    );
    for (const specifier of specifiers) {
      if (specifier.startsWith('.') || specifier.startsWith('node:')) {
        continue;
      }
      (file.endsWith('.d.ts') ? externalDeclarationImports : externalRuntimeImports).push([
        file,
        specifier
      ]);
    }
    if (file.endsWith('.d.ts')) {
      for (const match of text.matchAll(/\/\/\/\s*<reference\s+types=["']([^"']+)["']/g)) {
        externalDeclarationImports.push([file, match[1]]);
      }
    }
  }
  assert(
    externalRuntimeImports.length === 0,
    `compiled runtime has no external imports (found ${JSON.stringify(externalRuntimeImports)})`
  );
  assert(
    externalDeclarationImports.length === 0,
    `declarations are self-contained (found ${JSON.stringify(externalDeclarationImports)})`
  );

  // The consumer is a separate directory with its own package.json. The only
  // source of @chatwright/player-core is the tarball installed below.
  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify(
      { name: 'player-core-packed-consumer', version: '0.0.0', private: true, type: 'module' },
      null,
      2
    ) + '\n'
  );

  const install = run(
    'install tarball into consumer',
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarball
    ],
    { cwd: consumerDir }
  );

  const installedPackageDir = join(consumerDir, 'node_modules', ...packageName.split('/'));
  const installedManifestPath = join(installedPackageDir, 'package.json');
  assert(existsSync(installedManifestPath), 'consumer has an installed package manifest');
  const installedManifest = JSON.parse(readFileSync(installedManifestPath, 'utf8'));
  assert(
    Object.keys(installedManifest.dependencies ?? {}).length === 0,
    'installed package declares no dependencies'
  );

  const resolveStep = run(
    'resolve package from consumer',
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `console.log(import.meta.resolve(${JSON.stringify(packageName)}))`
    ],
    { cwd: consumerDir }
  );
  const resolvedUrl = resolveStep.stdout.split('\n').filter(Boolean).pop();
  assert(resolvedUrl.startsWith('file://'), `resolved to a file URL (${resolvedUrl})`);
  const resolvedPath = realpathSync(fileURLToPath(resolvedUrl));
  const consumerReal = realpathSync(consumerDir);
  assert(
    resolvedPath.startsWith(consumerReal + '/'),
    `resolved package lives in the consumer (${resolvedPath})`
  );
  assert(
    !resolvedPath.startsWith(realpathSync(repoRoot) + '/'),
    'resolved package is not a repository path'
  );

  // Runtime proof against the packed export surface.
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  writeFileSync(join(consumerDir, 'golden.chatwright.json'), JSON.stringify(golden, null, 2) + '\n');

  writeFileSync(
    join(consumerDir, 'verify-runtime.mjs'),
    `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  animationForJournalEntry,
  buildTimeline,
  chaptersOf,
  settledStateAt
} from '${packageName}';

const bundle = JSON.parse(readFileSync(new URL('./golden.chatwright.json', import.meta.url), 'utf8'));
const run = bundle.runs[0];
const timeline = buildTimeline(run);

const outcomes = [];
const check = (name, fn) => {
  try {
    fn();
    outcomes.push({ name, outcome: 'pass' });
  } catch (error) {
    outcomes.push({ name, outcome: 'fail', error: error.message });
    throw error;
  }
};

check('existing golden timeline is 10 steps with contiguous indexes', () => {
  assert.equal(timeline.length, 10);
  timeline.forEach((step, index) => assert.equal(step.index, index));
});

check('existing golden run is one chapter covering the whole timeline', () => {
  assert.deepEqual(
    chaptersOf(timeline).map((chapter) => [chapter.partId, chapter.startIndex, chapter.endIndex]),
    [['exploration', 0, timeline.length - 1]]
  );
});

const final = settledStateAt(timeline, timeline.length - 1);
check('existing golden final state has two visible messages', () => {
  assert.equal(final.messageCount, 2);
  assert.equal(final.chats.length, 1);
  assert.equal(final.chats[0].chatId, 42);
});

check('existing golden bot message is edited in place to v1', () => {
  const messages = final.chats[0].items
    .filter((item) => item.kind === 'message')
    .map((item) => item.message);
  const bot = messages.find((message) => message.messageId === 2);
  assert.ok(bot, 'bot message 2 exists');
  assert.equal(bot.version, 1);
  assert.equal(bot.text, 'Howdy stranger');
  assert.equal(bot.edited, true);
  assert.deepEqual(bot.history.map((version) => [version.version, version.text]), [
    [0, 'Choose your language:'],
    [1, 'Howdy stranger']
  ]);
  assert.deepEqual(bot.pressedActionIds, ['act1']);
});

check('existing golden action press highlights the target message', () => {
  const messages = final.chats[0].items
    .filter((item) => item.kind === 'message')
    .map((item) => item.message);
  assert.equal(messages.filter((message) => !message.deleted).length, 2);
});

check('sequential and direct-seek states are identical at every index', () => {
  const ascending = new Map();
  for (let index = -1; index < timeline.length; index++) {
    ascending.set(index, settledStateAt(timeline, index));
  }
  for (let index = timeline.length - 1; index >= -1; index--) {
    assert.deepEqual(settledStateAt(timeline, index), ascending.get(index));
  }
});

check('edit animation selection is presentation metadata, not a mutation', () => {
  const editEntry = run.chats[0].entries.find((entry) => entry.version > 0);
  assert.equal(animationForJournalEntry(run.chats[0].chatId, editEntry, false).primitive, 'edit-morph');
  assert.deepEqual(settledStateAt(timeline, timeline.length - 1), final);
});

// A separate synthetic deletion proves the same packed exports fold a
// deletion to an invisible message while retaining its history.
const deletionRun = {
  id: 'deletion-proof',
  platform: 'telegram',
  endpointProfile: 'platform-emulated',
  actors: null,
  chats: [{
    chatId: 5,
    entries: [
      { direction: 'user', kind: 'message', messageId: 1, refMessageId: 0, version: 0, text: 'keep?', actions: null, method: '', at: '2026-01-01T00:00:00.000Z', fromId: 1 },
      { direction: 'bot', kind: 'uncaptured', messageId: 0, refMessageId: 1, version: 0, text: '', actions: null, method: 'deleteMessage', at: '2026-01-01T00:00:01.000Z', fromId: 2 }
    ]
  }],
  parts: [{ id: 'p', kind: 'deterministic', journalBoundary: { chats: [{ chatId: 5, firstEntry: 0, entryCount: 2 }] } }]
};
const deletionTimeline = buildTimeline(deletionRun);
const deletionState = settledStateAt(deletionTimeline, deletionTimeline.length - 1);
check('declared deletion yields zero visible messages but keeps the entry', () => {
  assert.equal(deletionState.messageCount, 0);
  const message = deletionState.chats[0].items.find((item) => item.kind === 'message').message;
  assert.equal(message.messageId, 1);
  assert.equal(message.deleted, true);
  assert.equal(message.text, 'keep?');
});

console.log(JSON.stringify({ outcomes, finalMessageCount: final.messageCount }, null, 2));
`
  );

  const runtimeProof = run('run packed runtime proof', process.execPath, ['verify-runtime.mjs'], {
    cwd: consumerDir
  });
  const runtimeOutcomes = JSON.parse(runtimeProof.stdout);
  assert(
    runtimeOutcomes.outcomes.every((outcome) => outcome.outcome === 'pass'),
    'all packed runtime checks passed'
  );

  // Declaration proof: a compiler is supplied explicitly, but every package
  // type and value resolves from the tarball install above.
  writeFileSync(
    join(consumerDir, 'verify-types.ts'),
    `import {
  buildTimeline,
  chaptersOf,
  settledStateAt,
  type Bundle,
  type BundleRun,
  type Chapter,
  type PlatformJournalEntry,
  type SettledState,
  type Step
} from '${packageName}';

const entry: PlatformJournalEntry = {
  direction: 'user',
  kind: 'message',
  messageId: 1,
  refMessageId: 0,
  version: 0,
  text: 'typed',
  actions: null,
  method: '',
  at: '2026-01-01T00:00:00.000Z',
  fromId: 7
};

const run: BundleRun = {
  id: 'typed',
  platform: 'telegram',
  endpointProfile: 'platform-emulated',
  actors: null,
  chats: [{ chatId: 7, entries: [entry] }],
  parts: [
    {
      id: 'p',
      title: 'Typed',
      kind: 'deterministic',
      journalBoundary: { chats: [{ chatId: 7, firstEntry: 0, entryCount: 1 }] }
    }
  ]
};

const bundle: Bundle = {
  format: 'https://chatwright.dev/formats/run-bundle/v1',
  metadata: { createdAt: '2026-01-01T00:00:00.000Z' },
  runs: [run]
};

const timeline: Step[] = buildTimeline(bundle.runs?.[0]);
const chapters: Chapter[] = chaptersOf(timeline);
const state: SettledState = settledStateAt(timeline, timeline.length - 1);
const messageCount: number = state.messageCount;

void chapters;
void messageCount;
`
  );

  const compiler = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  assert(existsSync(compiler), `compiler exists at ${compiler}`);
  const typeProof = run(
    'typecheck consumer declarations',
    process.execPath,
    [
      compiler,
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--lib',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'verify-types.ts'
    ],
    { cwd: consumerDir }
  );

  const summary = {
    package: {
      name: packedManifest.name,
      version: packedManifest.version,
      tarball,
      sha256: tarballSha256,
      bytes: tarballBytes.length,
      fileList,
      dependencyFields: Object.fromEntries(
        dependencyFields.map((field) => [field, packedManifest[field] ?? null])
      ),
      externalRuntimeImports,
      externalDeclarationImports
    },
    consumer: {
      path: consumerDir,
      resolvedUrl,
      resolvedPath,
      installExit: install.exit,
      runtimeExit: runtimeProof.exit,
      typecheckExit: typeProof.exit,
      runtimeOutcomes: runtimeOutcomes.outcomes
    },
    steps: steps.map(({ label, command, cwd, exit }) => ({ label, command, cwd, exit })),
    buildOutputPresent: build.stdout.length > 0 || build.stderr.length > 0
  };

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`Proof work directory kept at ${consumerDir}`);
  process.exitCode = 1;
}
