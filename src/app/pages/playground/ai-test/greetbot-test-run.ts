/**
 * Builds a runnable `@chatwright/runtime` `Run` for the "AI test" tab's
 * built-in greetbot scenario: the engine's own single ai-goal part
 * (`buildGreetbotRun`) plus a second, deterministic part that re-evaluates
 * `greetbotAssertions()` against the finished journal.
 *
 * @remarks
 * `ExecuteOptions.onAssertion` (the run UI's assertion-chip feed) only fires
 * for a `DeterministicPart` — greetbot's own scenario is pure ai-goal, so on
 * its own it never produces a chip. The appended verify part performs no
 * steps of its own (`steps: []`); it only evaluates `greetbotAssertions()`
 * against whatever the ai-goal part already drove, giving the run UI real
 * pass/fail/unverified chips for a scenario that would otherwise have none.
 */

import {
  GREETBOT_CHAT_ID,
  GREETBOT_USER,
  buildGreetbotRun,
  greetbotAssertions,
  type DeterministicPart,
  type Provider,
  type Run,
  type Session
} from '@chatwright/runtime';

/** The id of the deterministic verify part this builder appends to `buildGreetbotRun`'s own single part. */
export const GREETBOT_VERIFY_PART_ID = 'greetbot-verify';

export interface GreetbotTestRunOptions {
  /** The run's clock (epoch ms) — the ai-goal part's campaign/loop clock. */
  readonly now: () => number;
  /** The engine `Provider` driving the ai-goal loop — BYOK/Local/Cloud in production, a `ScriptedProvider` in tests. */
  readonly provider: Provider;
}

/** Builds the greetbot ai-goal part plus its deterministic verify part, over `session`. */
export function buildGreetbotTestRun(session: Session, options: GreetbotTestRunOptions): Run {
  const base = buildGreetbotRun(session, { now: options.now, provider: options.provider });
  const verifyPart: DeterministicPart = {
    kind: 'deterministic',
    id: GREETBOT_VERIFY_PART_ID,
    title: 'Verify onboarding evidence',
    chatId: GREETBOT_CHAT_ID,
    user: GREETBOT_USER,
    steps: [],
    assertions: greetbotAssertions()
  };
  return { ...base, parts: [...base.parts, verifyPart] };
}
