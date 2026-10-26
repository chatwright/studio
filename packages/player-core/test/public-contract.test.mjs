import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  animationForJournalEntry,
  buildTimeline,
  chaptersOf,
  settledStateAt
} from '../dist/index.js';

/**
 * A compact, fully synthetic run bundle that exercises the observable playback
 * contract: a user message, a bot message, an action press, an in-place edit and
 * a deletion, followed by an AI-goal part. Expected values are declared here,
 * not derived from the implementation.
 */
const run = {
  id: 'player-core-contract',
  platform: 'telegram',
  endpointProfile: 'platform-emulated',
  actors: [
    { id: 'user', type: 'human', platformIdentities: { telegram: { userId: 7 } } },
    { id: 'bot', type: 'bot', platformIdentities: { telegram: { userId: 1 } } }
  ],
  chats: [
    {
      chatId: 7,
      entries: [
        {
          direction: 'user',
          kind: 'message',
          messageId: 1,
          refMessageId: 0,
          version: 0,
          text: 'hello',
          actions: null,
          method: '',
          at: '2026-01-01T10:00:00.000Z',
          fromId: 7
        },
        {
          direction: 'bot',
          kind: 'message',
          messageId: 2,
          refMessageId: 0,
          version: 0,
          text: 'one',
          actions: [[{ label: 'Go', id: 'go', url: '' }]],
          method: '',
          at: '2026-01-01T10:00:01.000Z',
          fromId: 1
        },
        {
          direction: 'user',
          kind: 'action',
          messageId: 0,
          refMessageId: 2,
          version: 0,
          text: 'go',
          actions: null,
          method: '',
          at: '2026-01-01T10:00:02.000Z',
          fromId: 7
        },
        {
          direction: 'bot',
          kind: 'message',
          messageId: 2,
          refMessageId: 0,
          version: 1,
          text: 'two',
          actions: null,
          method: '',
          at: '2026-01-01T10:00:03.000Z',
          fromId: 1
        },
        {
          direction: 'bot',
          kind: 'uncaptured',
          messageId: 0,
          refMessageId: 1,
          version: 0,
          text: '',
          actions: null,
          method: 'deleteMessage',
          at: '2026-01-01T10:00:04.000Z',
          fromId: 1
        }
      ]
    }
  ],
  parts: [
    {
      id: 'transcript',
      title: 'Transcript',
      kind: 'deterministic',
      journalBoundary: { chats: [{ chatId: 7, firstEntry: 0, entryCount: 5 }] }
    },
    {
      id: 'mind',
      title: 'Reasoning',
      kind: 'ai-goal',
      journalBoundary: { chats: [] },
      aiGoal: {
        goal: {
          id: 'g1',
          title: 'Goal',
          description: '',
          tasks: null,
          constraints: null,
          budgets: {
            maxSteps: 0,
            maxDurationNanoseconds: 0,
            maxRepeatedFailures: 0,
            maxCost: null
          }
        },
        actorId: 'user',
        events: [
          {
            index: 0,
            at: '2026-01-01T10:00:05.000Z',
            taskId: 't1',
            observationSequence: 1,
            validation: { checked: false, reason: '' },
            proposal: { kind: 'send-text', text: 'hi', actionId: '', observationSequence: 1, rationale: '' },
            usage: { model: '', inputTokens: 0, outputTokens: 0, latencyNanoseconds: 0 },
            action: { kind: 'executed', detail: '' }
          }
        ],
        observations: [],
        report: {
          schemaVersion: 1,
          goalId: 'g1',
          goalTitle: 'Goal',
          stopReason: '',
          steps: 1,
          elapsedNanoseconds: 0,
          tasks: null,
          findings: null,
          usage: { inputTokens: 0, outputTokens: 0, callCount: 0 }
        }
      }
    }
  ]
};

const expectedFinal = {
  messageCount: 1,
  messages: [
    { messageId: 1, deleted: true, text: 'hello' },
    { messageId: 2, deleted: false, version: 1, text: 'two', edited: true }
  ]
};

describe('timeline contract', () => {
  it('builds a deterministic, contiguous timeline with one chapter per part', () => {
    const first = buildTimeline(run);
    const second = buildTimeline(run);

    assert.equal(first.length, 8, 'five journal steps plus three AI beats');
    assert.deepEqual(
      first.map((step) => [step.index, step.kind, step.partIndex]),
      second.map((step) => [step.index, step.kind, step.partIndex])
    );
    first.forEach((step, index) => assert.equal(step.index, index));

    assert.deepEqual(
      chaptersOf(first).map((chapter) => [chapter.partId, chapter.startIndex, chapter.endIndex]),
      [
        ['transcript', 0, 4],
        ['mind', 5, 7]
      ]
    );
  });

  it('handles a missing run without throwing', () => {
    assert.deepEqual(buildTimeline(null), []);
    assert.deepEqual(buildTimeline(undefined), []);
  });
});

describe('settled-state contract', () => {
  const timeline = buildTimeline(run);

  it('folds messages, presses, edits and deletions to the declared final state', () => {
    const final = settledStateAt(timeline, timeline.length - 1);
    assert.equal(final.chats.length, 1);
    assert.equal(final.messageCount, expectedFinal.messageCount);

    const chat = final.chats[0];
    assert.equal(chat.chatId, 7);

    const messages = chat.items
      .filter((item) => item.kind === 'message')
      .map((item) => item.message);

    assert.deepEqual(
      messages.map((message) => ({
        messageId: message.messageId,
        deleted: message.deleted,
        text: message.text
      })),
      expectedFinal.messages.map(({ messageId, deleted, text }) => ({ messageId, deleted, text }))
    );

    const edited = messages.find((message) => message.messageId === 2);
    assert.equal(edited.version, 1);
    assert.equal(edited.edited, true);
    assert.deepEqual(edited.history.map((version) => [version.version, version.text]), [
      [0, 'one'],
      [1, 'two']
    ]);
    assert.deepEqual(edited.pressedActionIds, ['go']);
  });

  it('gives the same state for the same index regardless of how it was reached', () => {
    const ascending = new Map();
    for (let index = -1; index < timeline.length; index++) {
      ascending.set(index, settledStateAt(timeline, index));
    }

    // Walk backwards (a seek-heavy path), then jump directly to both ends.
    for (let index = timeline.length - 1; index >= -1; index--) {
      assert.deepEqual(settledStateAt(timeline, index), ascending.get(index));
    }
    assert.deepEqual(settledStateAt(timeline, timeline.length - 1), ascending.get(timeline.length - 1));
    assert.deepEqual(settledStateAt(timeline, -1), ascending.get(-1));
  });

  it('shows the pre-edit transcript before the edit and the deletion after it', () => {
    assert.equal(settledStateAt(timeline, 1).messageCount, 2);
    assert.equal(settledStateAt(timeline, 2).messageCount, 2);
    assert.equal(settledStateAt(timeline, 3).messageCount, 2);
    assert.equal(settledStateAt(timeline, 4).messageCount, 1);

    const beforeEdit = settledStateAt(timeline, 2).chats[0].items.find(
      (item) => item.kind === 'message' && item.message.messageId === 2
    );
    assert.equal(beforeEdit.message.text, 'one');
    assert.equal(beforeEdit.message.version, 0);
    assert.deepEqual(beforeEdit.message.pressedActionIds, ['go']);

    assert.equal(settledStateAt(timeline, -1).messageCount, 0);
  });
});

describe('animation specification contract', () => {
  const entries = run.chats[0].entries;

  it('maps message, edit and deletion mutations to declarative primitives', () => {
    assert.equal(animationForJournalEntry(7, entries[0], false).primitive, 'compose-and-send');
    assert.equal(animationForJournalEntry(7, entries[1], false).primitive, 'reply-keyboard-in');
    assert.equal(animationForJournalEntry(7, entries[3], false).primitive, 'edit-morph');
    assert.equal(animationForJournalEntry(7, entries[4], false).primitive, 'vapour-delete');
  });
});
