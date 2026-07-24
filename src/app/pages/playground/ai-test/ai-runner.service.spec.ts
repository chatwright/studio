import { GREETBOT_CHAT_ID, ScriptedProvider, Session, buildRunBundle, type Prompt, type Proposal, type Provider, type ProposeResult } from '@chatwright/runtime';
import { describe, expect, it } from 'vitest';

import { AiRunnerService } from './ai-runner.service';
import { GREETBOT_VERIFY_PART_ID, buildGreetbotTestRun } from './greetbot-test-run';
import { withStopSignal } from './provider-source';
import { FakeGreetbotBot } from './testing/fake-greetbot-bot';

/** A deterministic, monotonically-advancing epoch-ms clock — the ai-goal part's own campaign/loop clock. */
function tickClock(startMs: number, stepMs = 1000): () => number {
  let current = startMs;
  return () => {
    const value = current;
    current += stepMs;
    return value;
  };
}

describe('AiRunnerService driving the built-in greetbot scenario (zero network)', () => {
  it('populates the transcript, reaches passing assertion chips, completes, and yields a run bundle', async () => {
    const session = new Session({
      clock: () => new Date('2026-07-24T12:00:00.000Z'),
      human: { id: 'arena', type: 'ai-agent', name: 'Arena' },
      bot: { id: 'greetbot', type: 'bot', name: 'GreetBot' }
    });
    session.registerBot(new FakeGreetbotBot());

    // FakeGreetbotBot lists English first (row 0, col 0). TelegramCodec
    // reserves message ids from one counter shared across both directions
    // per chat, so the user's own "/start" takes messageId 1 and the bot's
    // first reply (the language picker) always lands on messageId 2,
    // version 0 — so its Chatwright-synthetic action id is deterministically
    // "act-2-0-r0c0" (@chatwright/runtime's observe/engine.ts).
    // observationSequence 1 is always issued (the loop's very first observe,
    // before anything is ever proposed), so it is always valid to cite here
    // regardless of exactly how many observations preceded this step.
    const script: Proposal[] = [
      { kind: 'send-text', text: '/start', rationale: 'begin the conversation' },
      { kind: 'click', actionId: 'act-2-0-r0c0', observationSequence: 1, rationale: 'pick English' },
      { kind: 'send-text', text: 'Thanks!', rationale: 'acknowledge the greeting' },
      { kind: 'task-done', rationale: 'greeting acknowledged' }
    ];
    const scripted = new ScriptedProvider({ model: 'scripted-test', inputTokens: 4, outputTokens: 2, latencyMs: 0 }, ...script);

    const runner = new AiRunnerService();
    const provider = withStopSignal(scripted, () => runner.stopRequested());
    const run = buildGreetbotTestRun(session, { now: tickClock(1_000), provider });

    await runner.run(run);

    // (1) Transcript: the session's own journal — exactly what
    // `ChatPaneComponent.entries` renders live — is populated.
    const entries = session.journal(GREETBOT_CHAT_ID).entries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.direction === 'user' && entry.text === '/start')).toBe(true);
    expect(entries.some((entry) => entry.direction === 'bot' && entry.text === 'Howdy stranger')).toBe(true);

    // (2) Live wiring: onAssertion populated the assertion log, all passing.
    const verifyOutcomes = runner.assertionLog().filter((entry) => entry.partId === GREETBOT_VERIFY_PART_ID);
    expect(verifyOutcomes).toHaveLength(4);
    expect(verifyOutcomes.every((entry) => entry.outcome.verdict === 'pass')).toBe(true);

    // (3) Final result: both parts completed cleanly, no error.
    expect(runner.error()).toBeNull();
    expect(runner.status()).toBe('completed');
    const result = runner.result();
    expect(result).not.toBeNull();
    expect(result!.parts.map((part) => part.partId)).toEqual(['language-onboarding', GREETBOT_VERIFY_PART_ID]);
    expect(result!.parts.every((part) => part.status === 'completed')).toBe(true);

    // (4) A run bundle is produced, carrying both parts.
    const bundle = buildRunBundle(session, result!) as { runs: { parts: { id: string }[] }[] };
    expect(bundle.runs[0]!.parts.map((part) => part.id)).toEqual(['language-onboarding', GREETBOT_VERIFY_PART_ID]);
  });

  it('reports live progress via onProgress as the ai-goal loop iterates', async () => {
    const session = new Session({ clock: () => new Date('2026-07-24T12:00:00.000Z') });
    session.registerBot(new FakeGreetbotBot());

    const script: Proposal[] = [
      { kind: 'send-text', text: '/start', rationale: 'begin' },
      { kind: 'click', actionId: 'act-2-0-r0c0', observationSequence: 1, rationale: 'pick English' },
      { kind: 'send-text', text: 'Thanks!', rationale: 'ack' },
      { kind: 'task-done', rationale: 'done' }
    ];
    const scripted = new ScriptedProvider({ model: 'scripted-test', inputTokens: 1, outputTokens: 1, latencyMs: 0 }, ...script);

    const runner = new AiRunnerService();
    const run = buildGreetbotTestRun(session, { now: tickClock(1_000), provider: scripted });

    await runner.run(run);

    // At least one "loop" progress event landed, and the last one reports
    // the loop has stopped with a clean stop reason.
    const snapshot = runner.loopSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.stopped).toBe(true);
    expect(snapshot!.stopReason).toBe('goal-complete');
  });

  it('stop() causes the very next propose() call to throw, ending the run early (status "stopped")', async () => {
    const session = new Session({ clock: () => new Date('2026-07-24T12:00:00.000Z') });
    session.registerBot(new FakeGreetbotBot());

    const runner = new AiRunnerService();

    // Simulates the visitor pressing Stop while the FIRST proposal is still
    // "in flight": the request itself completes (shouldStop() had not yet
    // been set when withStopSignal checked), but every subsequent check
    // sees it and throws before this inner provider is asked for anything
    // further.
    const inner: Provider = {
      async propose(_prompt: Prompt): Promise<ProposeResult> {
        runner.stop();
        return {
          proposal: { kind: 'send-text', text: '/start', rationale: 'begin' },
          usage: { model: 'scripted-test', inputTokens: 1, outputTokens: 1, latencyMs: 0 }
        };
      }
    };
    const provider = withStopSignal(inner, () => runner.stopRequested());
    const run = buildGreetbotTestRun(session, { now: tickClock(1_000), provider });

    await runner.run(run);

    expect(runner.stopRequested()).toBe(true);
    expect(runner.status()).toBe('stopped');
    // Never reached the click/ack/done steps — the goal never completed.
    const entries = session.journal(GREETBOT_CHAT_ID).entries();
    expect(entries.some((entry) => entry.text === 'Thanks!')).toBe(false);
  });
});
