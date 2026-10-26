import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const childPath = join(here, 'browser-lifecycle-child.mjs');

function startChild(env = {}) {
  const child = spawn(process.execPath, [childPath], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  let settled = false;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(`child did not become ready: ${stderr}`));
    }, 10_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const match = /READY (\d+)/.exec(stdout);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.once('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`child exited before ready (code ${code}, signal ${signal}): ${stderr}`));
      }
    });
  });

  return {
    child,
    ready,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

function assertPortClosed(port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`owned port ${port} is still accepting connections`));
    }, 1_500);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(`owned port ${port} is still accepting connections`));
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function interruptAndRead(signal, env = {}) {
  const run = startChild(env);
  const port = await run.ready;
  run.child.kill(signal);
  const [code, exitSignal] = await once(run.child, 'exit');
  assert.equal(exitSignal, null, 'the handler exits through process.exit, not a second signal');
  const match = /SHUTDOWN (\{.*\})/.exec(run.stdout);
  assert.ok(match, `child did not report shutdown: ${run.stdout} ${run.stderr}`);
  const payload = JSON.parse(match[1]);
  await assertPortClosed(port);
  return { code, payload };
}

describe('browser proof lifecycle — interrupted, repeated and partially failing shutdown', () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    it(`${signal} closes context, browser and the owned server exactly once`, async () => {
      const { code, payload } = await interruptAndRead(signal);
      assert.equal(code, 0);
      assert.equal(payload.signal, signal);
      assert.deepEqual(payload.calls, { context: 1, browser: 1, server: 1 });
      assert.equal(payload.sameResult, true, 'repeated shutdown returns the same settled result');
      assert.equal(payload.attempts.length, 3, 'each resource is attempted exactly once');
      assert.equal(payload.status, 'browser, context and loopback server closed');
      assert.deepEqual(payload.errors, []);
    });
  }

  it('a rejected context close still closes the browser and server and reports the failure', async () => {
    const { code, payload } = await interruptAndRead('SIGTERM', { FAIL_CLOSE: 'context' });
    assert.equal(code, 1, 'cleanup failure is not reported as success');
    assert.deepEqual(payload.calls, { context: 1, browser: 1, server: 1 });
    assert.equal(payload.sameResult, true);
    assert.match(payload.status, /CLEANUP FAILURE: context: context close failed/);
    assert.deepEqual(payload.errors, ['context: context close failed']);
  });

  it('a rejected browser close still closes the server and reports the failure', async () => {
    const { code, payload } = await interruptAndRead('SIGINT', { FAIL_CLOSE: 'browser' });
    assert.equal(code, 1);
    assert.deepEqual(payload.calls, { context: 1, browser: 1, server: 1 });
    assert.match(payload.status, /CLEANUP FAILURE: browser: browser close failed/);
  });
});
