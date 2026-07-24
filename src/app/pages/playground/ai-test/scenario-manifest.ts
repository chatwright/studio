/**
 * Resolves an already-validated `ScenarioManifest` (see
 * `parseScenarioManifest` — structural validation only, no side effects) to
 * a runnable `Run` builder.
 *
 * @remarks
 * Only the built-in greetbot scenario is a REGISTERED, runnable scenario in
 * this Studio build today (`GREETBOT_SCENARIO`, see
 * `@chatwright/runtime`'s `scenario/greetbot.ts` doc comment: "building an
 * executable Run from it is the registered scenario's own concern"). A
 * manifest naming any other `scenario` id parses fine — it is structurally a
 * valid document — but has no runnable implementation here, and this module
 * says so explicitly rather than fabricating a run: the same "fidelity is
 * declared, never assumed" rule the rest of this app follows.
 */

import { GREETBOT_SCENARIO, type Provider, type Run, type ScenarioManifest, type Session } from '@chatwright/runtime';

import { buildGreetbotTestRun } from './greetbot-test-run';

export type ResolveManifestResult = { readonly ok: true; readonly run: Run } | { readonly ok: false; readonly error: string };

export interface ResolveManifestOptions {
  readonly now: () => number;
  readonly provider: Provider;
}

/** Resolves `manifest` to a runnable `Run` over `session`, or an honest "not runnable here yet" error. */
export function resolveManifestRun(session: Session, manifest: ScenarioManifest, options: ResolveManifestOptions): ResolveManifestResult {
  if (manifest.scenario === GREETBOT_SCENARIO.id) {
    return { ok: true, run: buildGreetbotTestRun(session, options) };
  }
  return {
    ok: false,
    error:
      `This manifest names scenario "${manifest.scenario}", but Studio only has a runnable implementation for ` +
      `"${GREETBOT_SCENARIO.id}" today.`
  };
}
