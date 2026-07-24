import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest runs this app's *pure* logic (src/app/player/engine, the bundle
 * parser, the Playground's pure reducers, and — since the "AI test" tab —
 * the `@chatwright/runtime`-consuming AI-runner logic, which is itself
 * framework/DOM-free) in a plain Node environment — no Angular TestBed, no
 * DOM. The engine is deliberately framework-free so its determinism can be
 * proven cheaply: same bundle + same seek → same settled state.
 *
 * The `@chatwright/runtime` alias mirrors tsconfig.json's own `paths` entry
 * (see scripts/vendor-runtime.mjs): Angular's builder reads tsconfig paths
 * itself, but a plain `vitest` run does not, so any spec importing
 * `@chatwright/runtime` needs this resolved explicitly too.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false
  },
  resolve: {
    alias: {
      '@chatwright/runtime': fileURLToPath(new URL('./.vendor/runtime-ts/src/index.ts', import.meta.url))
    }
  }
});
