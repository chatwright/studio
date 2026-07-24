import { GREETBOT_SCENARIO, ScriptedProvider, Session, type ScenarioManifest } from '@chatwright/runtime';
import { describe, expect, it } from 'vitest';

import { GREETBOT_VERIFY_PART_ID } from './greetbot-test-run';
import { resolveManifestRun } from './scenario-manifest';

function manifest(overrides: Partial<ScenarioManifest> = {}): ScenarioManifest {
  return {
    format: 'https://chatwright.dev/formats/scenario-manifest/v1',
    schemaVersion: 1,
    id: 'test-manifest',
    scenario: GREETBOT_SCENARIO.id,
    ...overrides
  };
}

describe('resolveManifestRun', () => {
  it('resolves the built-in greetbot scenario id to a runnable two-part Run', () => {
    const session = new Session();
    const provider = new ScriptedProvider({ model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 });
    const result = resolveManifestRun(session, manifest(), { now: () => 0, provider });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.parts.map((part) => part.id)).toEqual(['language-onboarding', GREETBOT_VERIFY_PART_ID]);
    }
  });

  it('honestly refuses an unknown scenario id — no Run is built', () => {
    const session = new Session();
    const provider = new ScriptedProvider({ model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 });
    const result = resolveManifestRun(session, manifest({ scenario: 'some-other-scenario' }), { now: () => 0, provider });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('some-other-scenario');
      expect(result.error).toContain(GREETBOT_SCENARIO.id);
    }
  });
});
