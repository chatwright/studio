import { GREETBOT_ACTOR_ID, GREETBOT_CHAT_ID, ScriptedProvider, Session } from '@chatwright/runtime';
import { describe, expect, it } from 'vitest';

import { GREETBOT_VERIFY_PART_ID, buildGreetbotTestRun } from './greetbot-test-run';

describe('buildGreetbotTestRun', () => {
  it('appends a deterministic verify part after the engine\'s own ai-goal part, over the same chat', () => {
    const session = new Session();
    const provider = new ScriptedProvider({ model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 });

    const run = buildGreetbotTestRun(session, { now: () => 0, provider });

    expect(run.environment.chatIds).toEqual([GREETBOT_CHAT_ID]);
    expect(run.parts).toHaveLength(2);

    const [aiGoalPart, verifyPart] = run.parts;
    expect(aiGoalPart!.kind).toBe('ai-goal');
    expect((aiGoalPart as { actorId: string }).actorId).toBe(GREETBOT_ACTOR_ID);

    expect(verifyPart!.kind).toBe('deterministic');
    expect(verifyPart!.id).toBe(GREETBOT_VERIFY_PART_ID);
    expect((verifyPart as { chatId: number }).chatId).toBe(GREETBOT_CHAT_ID);
    expect((verifyPart as { steps: unknown[] }).steps).toEqual([]);
    expect((verifyPart as { assertions: unknown[] }).assertions.length).toBeGreaterThan(0);
  });
});
