import { defineConfig } from 'vitest/config';

/**
 * Vitest runs the playback engine's *pure* core (src/app/player/engine and the
 * bundle parser) in a plain Node environment — no Angular TestBed, no DOM.
 * The engine is deliberately framework-free so its determinism can be proven
 * cheaply: same bundle + same seek → same settled state.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false
  }
});
