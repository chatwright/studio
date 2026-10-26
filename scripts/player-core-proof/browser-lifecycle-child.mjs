/**
 * Child process for the browser-lifecycle interruption proof. It owns a real
 * loopback server plus fake context/browser resources, then exits through the
 * same `createShutdown` path the browser proof uses when it receives a signal.
 */

import { createServer } from 'node:http';

import { createShutdown } from './browser-lifecycle.mjs';

const fail = process.env.FAIL_CLOSE ?? '';
const calls = { context: 0, browser: 0, server: 0 };
const resources = { context: null, browser: null, server: null };

resources.context = {
  async close() {
    calls.context += 1;
    if (fail === 'context') {
      throw new Error('context close failed');
    }
  }
};

resources.browser = {
  async close() {
    calls.browser += 1;
    if (fail === 'browser') {
      throw new Error('browser close failed');
    }
  }
};

const server = createServer((request, response) => response.end('ok'));
await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
resources.server = server;

async function closeServer(instance) {
  calls.server += 1;
  instance.closeAllConnections?.();
  await new Promise((resolveClose, rejectClose) => {
    instance.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

const shutdown = createShutdown(resources, closeServer);

async function finish(signal) {
  const first = await shutdown.shutdown();
  const second = await shutdown.shutdown();
  const payload = {
    signal,
    calls,
    status: first.status,
    errors: first.errors,
    sameResult: first === second,
    attempts: shutdown.attempts
  };
  const exitCode = first.errors.length === 0 ? 0 : 1;
  process.stdout.write(`SHUTDOWN ${JSON.stringify(payload)}\n`, () => process.exit(exitCode));
}

process.on('SIGINT', () => {
  void finish('SIGINT');
});
process.on('SIGTERM', () => {
  void finish('SIGTERM');
});

process.stdout.write(`READY ${server.address().port}\n`);
setInterval(() => {}, 1000);
