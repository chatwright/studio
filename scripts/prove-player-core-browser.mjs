#!/usr/bin/env node
/**
 * Real-browser embedding proof for @chatwright/player-core's presentation
 * transport, in addition to the Node packed-package proof.
 *
 * It builds and packs the real package, installs the tarball into a fresh
 * consumer outside this repository, serves only that consumer's files on an
 * ephemeral loopback port, and drives Chromium through native clicks and
 * keyboard input. Assertions use the settled transcript and effect/credit
 * counters, not screenshots alone; each screenshot records one
 * expected-versus-observed sentence.
 *
 * This is a synthetic caller-side fencing proof. It contains no SQL editor,
 * DataTug adapter or production grading claim.
 *
 * Usage: pnpm prove:player-core-browser
 * Requires: playwright-core (devDependency) and a cached Chromium or Chrome.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageName = '@chatwright/player-core';
const proofAssets = join(repoRoot, 'scripts', 'player-core-proof');

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
    throw new Error(`${label} failed (exit ${result.status})\n${step.stderr || step.stdout}`);
  }
  return step;
}

const workRoot = mkdtempSync(join(tmpdir(), 'chatwright-player-core-browser-'));
const packDir = join(workRoot, 'tarball');
const consumerDir = join(workRoot, 'consumer');
const browserDir = join(consumerDir, 'browser');
const evidenceDir = join(workRoot, 'evidence');
mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });
mkdirSync(browserDir, { recursive: true });
mkdirSync(evidenceDir, { recursive: true });

const evidence = [];
const checks = [];
const requests = [];
const pageErrors = [];
const consoleErrors = [];

let server = null;
let browser = null;
let context = null;
let cleanupStatus = 'not-needed';
let proofFailure = null;
let summary = null;

function check(name, condition, detail) {
  if (!condition) {
    throw new Error(`Browser proof assertion failed: ${name}${detail ? ` — ${detail}` : ''}`);
  }
  checks.push({ name, outcome: 'pass' });
}

function describe(snapshot) {
  return `${snapshot.status} at cursor ${snapshot.cursor}, ${snapshot.messages.length} visible message(s), ticket ${snapshot.waiting ? `#${snapshot.ticketId}` : 'none'}, credits ${snapshot.counters.credits}, validation consumptions ${snapshot.counters.validationConsumptions}, external actions ${snapshot.counters.externalActions}, submissions ${snapshot.counters.submissions}`;
}

async function startServer(root) {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };
  const realRoot = realpathSync(root);
  const instance = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/') {
        response.writeHead(302, { location: '/browser/index.html' }).end();
        return;
      }
      const requested = url.pathname;
      const candidate = resolve(realRoot, `.${decodeURIComponent(requested)}`);
      const realCandidate = realpathSync(candidate);
      if (realCandidate !== realRoot && !realCandidate.startsWith(realRoot + sep)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      const body = readFileSync(realCandidate);
      response.writeHead(200, {
        'content-type': contentTypes[extname(realCandidate)] ?? 'application/octet-stream',
        'cache-control': 'no-store'
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    instance.once('error', rejectListen);
    instance.listen(0, '127.0.0.1', resolveListen);
  });
  return instance;
}

async function closeServer(instance) {
  if (instance === null) {
    return;
  }
  instance.closeAllConnections?.();
  await new Promise((resolveClose, rejectClose) => {
    instance.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

async function snapshot(page) {
  return page.evaluate(() => window.__proof.snapshot());
}

async function waitForStatus(page, status, timeout = 8000) {
  await page.waitForFunction(
    (expected) => window.__proof?.snapshot().status === expected,
    status,
    { timeout }
  );
}

async function capture(page, name, expected) {
  const observed = await snapshot(page);
  const screenshot = join(evidenceDir, name);
  await page.screenshot({ path: screenshot, fullPage: true });
  evidence.push({
    screenshot: name,
    expected,
    observed: describe(observed)
  });
  return observed;
}

const zeroCounters = {
  externalActions: 0,
  submissions: 0,
  validationConsumptions: 0,
  credits: 0,
  staleRejections: 0,
  duplicateRejections: 0,
  revisitReleases: 0
};

try {
  run('build package', 'pnpm', ['--filter', packageName, 'build'], { cwd: repoRoot });
  const pack = run(
    'pack package',
    'pnpm',
    ['--filter', packageName, 'pack', '--pack-destination', packDir, '--json'],
    { cwd: repoRoot }
  );
  const packJson = JSON.parse(pack.stdout);
  const tarball = resolve(packDir, packJson.filename);
  const tarballSha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');

  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'player-core-browser-consumer', version: '0.0.0', private: true, type: 'module' }, null, 2) + '\n'
  );
  run(
    'install tarball into outside consumer',
    'npm',
    ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', tarball],
    { cwd: consumerDir }
  );

  for (const asset of ['index.html', 'main.js', 'styles.css']) {
    copyFileSync(join(proofAssets, 'browser', asset), join(browserDir, asset));
  }
  copyFileSync(join(proofAssets, 'adapter.mjs'), join(browserDir, 'adapter.mjs'));

  const installedIndex = join(consumerDir, 'node_modules', ...packageName.split('/'), 'dist', 'index.js');
  check('packed package is installed inside the outside consumer', existsSync(installedIndex), installedIndex);
  const installedReal = realpathSync(installedIndex);
  check('installed package is not a repository path', !installedReal.startsWith(realpathSync(repoRoot) + sep), installedReal);

  server = await startServer(consumerDir);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  check('proof server binds loopback only', server.address().address === '127.0.0.1', String(server.address().address));

  const { chromium } = await import('playwright-core');
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__proof));

  /* ---------------------------------------------------------- initial */
  let state = await snapshot(page);
  check('initial pre-roll is idle with an empty transcript', state.status === 'idle' && state.cursor === -1 && state.messages.length === 0);
  check('initial counters are all zero', JSON.stringify(state.counters) === JSON.stringify(zeroCounters));
  check(
    'browser resolved the package from the outside consumer install',
    state.resolvedPackageUrl === `${baseUrl}/node_modules/${packageName}/dist/index.js`,
    state.resolvedPackageUrl
  );
  await capture(page, '01-initial.png', 'idle pre-roll, no transcript, zero counters, package resolved from the consumer install');

  /* --------------------------------------------------- play and wait */
  await page.click('#play-button');
  await waitForStatus(page, 'waiting');
  state = await snapshot(page);
  check('Play reaches the caller-declared barrier at cursor 2', state.cursor === 2);
  check('waiting shows exactly the three settled pre-barrier messages', state.messages.map((m) => m.text).join('|') === 'Open the incident|Read the retry evidence|Submit the whole challenge');
  check('a live ticket is visible and opaque', state.waiting === true && typeof state.ticketId === 'number');
  check('reaching a wait performs no effect and grants no credit', JSON.stringify(state.counters) === JSON.stringify(zeroCounters));
  await capture(page, '02-waiting.png', 'Play stops visibly at the barrier with a live ticket, three settled messages and zero effects');

  await page.waitForTimeout(1200);
  const stillWaiting = await snapshot(page);
  check('doing nothing keeps waiting at the same cursor and ticket', stillWaiting.status === 'waiting' && stillWaiting.cursor === 2 && stillWaiting.ticketId === state.ticketId);
  check('doing nothing changes no counter', JSON.stringify(stillWaiting.counters) === JSON.stringify(zeroCounters));
  await capture(page, '03-still-waiting.png', 'after 1.2s of no action the presentation is still waiting with identical state');

  /* -------------------------------------- keyboard assisted pass/credits */
  await page.keyboard.press('r');
  await waitForStatus(page, 'segment-end');
  state = await snapshot(page);
  check('validated assisted pass resumes exactly one segment', state.cursor === 3 && state.messages.length === 4);
  check('assisted pass grants one credit and one validation consumption', state.counters.credits === 1 && state.counters.validationConsumptions === 1);
  check('release performs no external action or submission', state.counters.externalActions === 0 && state.counters.submissions === 0);
  check('segment end requires explicit Next', state.status === 'segment-end' && state.waiting === false);
  await capture(page, '04-resumed-segment-end.png', 'assisted pass releases once, playback resumes within the brief segment and stops at its end');

  /* ------------------------------------------- watch/seek has no credit */
  const beforeWatch = state;
  await page.keyboard.press('s');
  state = await snapshot(page);
  check('Watch/seek reaches settled state without a ticket', state.status === 'preview' && state.cursor === 5 && state.waiting === false);
  check('Watch shows six settled messages', state.messages.length === 6 && state.transcriptCount === 6);
  check(
    'Watch/seek changes no effect, credit or validation counter',
    JSON.stringify(state.counters) === JSON.stringify(beforeWatch.counters)
  );
  await capture(page, '05-watch-no-credit.png', 'Watch reconstructs six settled messages at cursor 5 with no ticket and unchanged zero-effect counters');

  await page.click('#watch-barrier-button');
  state = await snapshot(page);
  check('direct seek remains preview-only at the barrier', state.cursor === 2 && state.status === 'preview' && state.waiting === false);
  check('preview seek grants no credit', JSON.stringify(state.counters) === JSON.stringify(beforeWatch.counters));
  await capture(page, '06-preview-barrier.png', 'a direct seek onto the barrier stays a preview with no ticket and no credit');

  /* --------------------------------------- explicit outer Next then play */
  await page.click('#next-segment-button');
  state = await snapshot(page);
  check('explicit Next enters the discussion segment at its first step', state.cursor === 4 && state.segmentId === 'discussion' && state.status === 'idle');
  check('entering a segment changes no credit', JSON.stringify(state.counters) === JSON.stringify(beforeWatch.counters));

  /* ------------------------------------ attempt A: pass and stored record */
  await page.click('#attempt-a-button');
  await waitForStatus(page, 'waiting');
  await page.click('#release-pass-button');
  await waitForStatus(page, 'segment-end');
  state = await snapshot(page);
  check('attempt A records a second credit with the same fresh-envelope path', state.counters.credits === 2 && state.counters.validationConsumptions === 2);
  await capture(page, '07-attempt-a-complete.png', 'attempt A completes once and stores an execution-owned completion outside the envelope');

  /* --------------------------- attempt B: stale rejection and stored revisit */
  await page.click('#attempt-b-button');
  await waitForStatus(page, 'waiting');
  const attemptB = await snapshot(page);
  check('attempt B starts at the barrier with no new credit', attemptB.cursor === 2 && attemptB.counters.credits === 2);

  // A preview seek revokes the B ticket; Play must consult the barrier again.
  const revokedTicket = attemptB.ticketId;
  await page.click('#watch-barrier-button');
  state = await snapshot(page);
  check('seek revoked attempt B ticket', state.waiting === false && state.status === 'preview');
  await page.click('#play-button');
  await waitForStatus(page, 'waiting');
  state = await snapshot(page);
  check('Play after preview still waits at the first open barrier', state.cursor === 2 && state.waiting === true);
  check('the reopened ticket is a new lifetime ticket', state.ticketId !== revokedTicket, `${revokedTicket} → ${state.ticketId}`);
  check('preview plus Play grants no credit', state.counters.credits === 2);

  const beforeStale = state;
  await page.click('#stale-button');
  state = await snapshot(page);
  check('stale attempt-A result is rejected while waiting for B', state.waiting === true && state.cursor === 2);
  check('stale rejection advances nothing and grants nothing', JSON.stringify(state.counters) === JSON.stringify({ ...beforeStale.counters, staleRejections: beforeStale.counters.staleRejections + 1 }));
  await capture(page, '08-stale-rejected.png', 'a stale attempt-A result is rejected under attempt B without advancing or granting credit');

  await page.click('#release-stored-button');
  await waitForStatus(page, 'segment-end');
  state = await snapshot(page);
  check('stored completion A releases only the current B presentation ticket', state.cursor === 3 && state.counters.revisitReleases === 1);
  check('stored revisit invents no new result, effect, submission or credit', state.counters.credits === 2 && state.counters.validationConsumptions === 2 && state.counters.externalActions === 0 && state.counters.submissions === 0);
  await capture(page, '09-stored-revisit.png', 'stored completion A releases the current B ticket and resumes presentation without a new result or effect');

  await page.click('#duplicate-button');
  state = await snapshot(page);
  check('duplicate release is rejected once', state.counters.duplicateRejections === 1);
  check('duplicate release grants no extra credit', state.counters.credits === 2);
  await capture(page, '10-duplicate-rejected.png', 'a duplicate release of the consumed ticket is rejected with no extra credit');

  /* ------------------------------------------------------------ hygiene */
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('; '));
  check('no console errors', consoleErrors.length === 0, consoleErrors.join('; '));
  const foreignRequests = requests.filter((url) => !url.startsWith(baseUrl));
  check('every browser request stayed on the proof origin', foreignRequests.length === 0, foreignRequests.join(', '));
  check(
    'the proof served the consumer install and assets only',
    requests.every(
      (url) =>
        url === `${baseUrl}/` ||
        url === `${baseUrl}/browser/index.html` ||
        url.startsWith(`${baseUrl}/browser/`) ||
        url.startsWith(`${baseUrl}/node_modules/${packageName}/`)
    ),
    requests.join(', ')
  );

  summary = {
    proof: 'player-core packed browser embedding (synthetic caller-side fencing)',
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
      mode: 'headless'
    },
    server: {
      pid: process.pid,
      port,
      address: server.address().address,
      proofRoot: workRoot,
      consumer: consumerDir,
      bind: '127.0.0.1 only'
    },
    package: {
      name: packageName,
      tarball,
      sha256: tarballSha256,
      installedIndex: installedReal
    },
    evidence,
    checks,
    steps: steps.map(({ label, command, cwd, exit }) => ({ label, command, cwd, exit })),
    cleanupStatus: 'pending'
  };

  writeFileSync(join(workRoot, 'browser-proof-summary.json'), JSON.stringify(summary, null, 2) + '\n');
} catch (error) {
  proofFailure = error;
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  try {
    if (context !== null) {
      await context.close();
      context = null;
    }
    if (browser !== null) {
      await browser.close();
      browser = null;
    }
    await closeServer(server);
    server = null;
    cleanupStatus = 'browser, context and loopback server closed';
  } catch (cleanupError) {
    cleanupStatus = `CLEANUP FAILURE: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
    console.error(cleanupStatus);
    if (proofFailure === null) {
      proofFailure = cleanupError;
    }
  }

  if (proofFailure === null) {
    const reportPath = join(workRoot, 'browser-proof-summary.json');
    if (summary !== null) {
      summary.cleanupStatus = cleanupStatus;
      writeFileSync(reportPath, JSON.stringify(summary, null, 2) + '\n');
      console.log(JSON.stringify(summary, null, 2));
    }
    console.log(`\nCleanup: ${cleanupStatus}`);
  } else {
    console.error(`\nProof work directory kept at ${workRoot}`);
    console.error(`Cleanup: ${cleanupStatus}`);
    process.exitCode = 1;
  }
}
