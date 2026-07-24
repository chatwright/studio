import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';

/**
 * A cheap, DOM-free check of the route *table* (paths, redirects, nesting) —
 * not a TestBed/Router integration test. This module's `loadComponent`
 * callbacks are never invoked here (this suite runs in Vitest's plain Node
 * environment, see vitest.config.ts), only inspected for shape, so it stays
 * fast and framework-free like the rest of this repo's unit suite.
 */
describe('routes', () => {
  it('mounts the four design-prototype pages as children of the prototypes/ prefix', () => {
    const prototypes = routes.find((route) => route.path === 'prototypes');
    expect(prototypes).toBeDefined();
    expect(prototypes?.children?.map((child) => child.path)).toEqual([
      'workspace',
      'emulator',
      'scenario',
      'run'
    ]);
    for (const child of prototypes?.children ?? []) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });

  it('redirects the four legacy top-level prototype paths under prototypes/, preserving query params by default', () => {
    const legacyRedirects: Record<string, string> = {
      workspace: 'prototypes/workspace',
      emulator: 'prototypes/emulator',
      scenario: 'prototypes/scenario',
      run: 'prototypes/run'
    };

    for (const [path, target] of Object.entries(legacyRedirects)) {
      const route = routes.find((candidate) => candidate.path === path && candidate.redirectTo !== undefined);
      expect(route, `expected a redirectTo route for /${path}`).toBeDefined();
      expect(route?.redirectTo).toBe(target);
      // pathMatch: 'full' — a plain string redirectTo (no matcher function)
      // is what preserves query params/fragment on the resulting UrlTree.
      expect(route?.pathMatch).toBe('full');
    }
  });

  it('keeps player and playground as real, top-level lazy routes (not redirects)', () => {
    for (const path of ['player', 'playground']) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route, `expected a route for /${path}`).toBeDefined();
      expect(typeof route?.loadComponent).toBe('function');
      expect(route?.redirectTo).toBeUndefined();
    }
  });

  it('sends the root path and any unmatched path to Playground — the real front door', () => {
    const rootRoute = routes.find((route) => route.path === '');
    expect(rootRoute?.redirectTo).toBe('playground');
    expect(rootRoute?.pathMatch).toBe('full');

    const wildcardRoute = routes.find((route) => route.path === '**');
    expect(wildcardRoute?.redirectTo).toBe('playground');
  });
});
