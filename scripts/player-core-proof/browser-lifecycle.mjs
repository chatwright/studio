/**
 * Idempotent shutdown for the browser proof's owned resources.
 *
 * The proof owns exactly one browser, one browser context and one loopback
 * server. Shutdown must be safe from `finally`, from SIGINT/SIGTERM, and from a
 * repeated call: it attempts each close exactly once, independently of the
 * others, and reports every failure rather than silently suppressing it.
 */

const CLOSED_MESSAGE = 'browser, context and loopback server closed';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {{ context: object | null, browser: object | null, server: object | null }} resources
 *   Mutable resource slots. Each slot is cleared after its close is attempted.
 * @param {(server: object) => Promise<void>} closeServer
 */
export function createShutdown(resources, closeServer) {
  let resultPromise = null;
  const attempts = [];

  async function closeOne(name, close) {
    const resource = resources[name];
    if (resource === null || resource === undefined) {
      return { name, attempted: false, closed: false, error: null };
    }
    const attempt = { name, attempted: true, closed: false, error: null };
    attempts.push(attempt);
    try {
      await close(resource);
      attempt.closed = true;
    } catch (error) {
      attempt.error = errorMessage(error);
    }
    // Clear even a failed slot: the attempt happened and the resource must not
    // be reused. The idempotent promise below owns the single-retry boundary.
    resources[name] = null;
    return attempt;
  }

  function shutdown() {
    if (resultPromise !== null) {
      return resultPromise;
    }
    resultPromise = (async () => {
      const results = [];
      // Sequential order (context, browser, server) but independent attempts:
      // a rejected context close must not skip the browser or the server.
      results.push(await closeOne('context', (context) => context.close()));
      results.push(await closeOne('browser', (browser) => browser.close()));
      results.push(await closeOne('server', (server) => closeServer(server)));

      const errors = results
        .filter((result) => result.error !== null)
        .map((result) => `${result.name}: ${result.error}`);
      return Object.freeze({
        status:
          errors.length === 0
            ? CLOSED_MESSAGE
            : `CLEANUP FAILURE: ${errors.join('; ')}`,
        errors: Object.freeze(errors),
        resources: Object.freeze(results.map((result) => Object.freeze({ ...result })))
      });
    })();
    return resultPromise;
  }

  return Object.freeze({
    shutdown,
    get attempts() {
      return attempts.map((attempt) => ({ ...attempt }));
    },
    get closedMessage() {
      return CLOSED_MESSAGE;
    }
  });
}
