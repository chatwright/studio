import { describe, expect, it } from 'vitest';

import { JournalEntryLike, reduceJournalEntries } from './bubble-reducer';

function entry(overrides: Partial<JournalEntryLike>): JournalEntryLike {
  return {
    direction: 'bot',
    kind: 'message',
    messageId: 0,
    refMessageId: 0,
    version: 0,
    text: '',
    method: '',
    at: '2026-07-23T10:00:00.000Z',
    fromId: 0,
    ...overrides
  };
}

describe('reduceJournalEntries', () => {
  it('returns an empty timeline for no entries', () => {
    const timeline = reduceJournalEntries([]);
    expect(timeline.items).toEqual([]);
    expect(timeline.pressedActionIds.size).toBe(0);
  });

  it('turns a user message into one bubble', () => {
    const timeline = reduceJournalEntries([
      entry({ direction: 'user', messageId: 1, text: '/start', fromId: 42 })
    ]);
    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0]).toMatchObject({ kind: 'bubble', direction: 'user', messageId: 1, text: '/start', edited: false });
  });

  it('turns a bot sendMessage into a bubble carrying its inline keyboard', () => {
    const timeline = reduceJournalEntries([
      entry({
        direction: 'bot',
        messageId: 2,
        text: 'Choose your language',
        method: 'sendMessage',
        actions: [[{ label: 'English', id: 'lang:en', url: '' }]]
      })
    ]);
    const bubble = timeline.items[0];
    expect(bubble.kind).toBe('bubble');
    if (bubble.kind === 'bubble') {
      expect(bubble.actions).toEqual([[{ label: 'English', id: 'lang:en', url: '' }]]);
    }
  });

  it('an editMessageText entry updates the same bubble in place, not a new one', () => {
    const timeline = reduceJournalEntries([
      entry({ direction: 'bot', messageId: 2, version: 0, text: 'Choose your language', method: 'sendMessage' }),
      entry({ direction: 'bot', messageId: 2, version: 1, text: 'Howdy stranger', method: 'editMessageText' })
    ]);
    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0]).toMatchObject({ messageId: 2, text: 'Howdy stranger', version: 1, edited: true });
  });

  it('an editMessageText entry with no reply_markup keeps the previous actions, like real Telegram', () => {
    const actions = [[{ label: 'English', id: 'lang:en', url: '' }]];
    const timeline = reduceJournalEntries([
      entry({ direction: 'bot', messageId: 2, version: 0, text: 'Choose your language', actions }),
      entry({ direction: 'bot', messageId: 2, version: 1, text: 'Howdy stranger', actions: undefined })
    ]);
    const bubble = timeline.items[0];
    expect(bubble.kind).toBe('bubble');
    if (bubble.kind === 'bubble') {
      expect(bubble.actions).toEqual(actions);
    }
  });

  it('an edit does not move the bubble out of its original chat position', () => {
    const timeline = reduceJournalEntries([
      entry({ direction: 'user', messageId: 1, text: '/start' }),
      entry({ direction: 'bot', messageId: 2, version: 0, text: 'Choose your language' }),
      entry({ direction: 'user', messageId: 3, text: 'Thanks!' }),
      entry({ direction: 'bot', messageId: 2, version: 1, text: 'Howdy stranger' })
    ]);
    expect(timeline.items.map((item) => (item.kind === 'bubble' ? item.messageId : `note:${item.method}`))).toEqual([
      1, 2, 3
    ]);
    expect(timeline.items[1]).toMatchObject({ text: 'Howdy stranger', edited: true });
  });

  it('an action (button click) entry does not produce its own bubble, and marks the button pressed', () => {
    const timeline = reduceJournalEntries([
      entry({ direction: 'bot', messageId: 2, text: 'Choose your language' }),
      entry({ direction: 'user', kind: 'action', refMessageId: 2, text: 'lang:en' })
    ]);
    expect(timeline.items).toHaveLength(1);
    expect(timeline.pressedActionIds.get(2)?.has('lang:en')).toBe(true);
  });

  it('an uncaptured entry becomes an honest note, never a fabricated reply', () => {
    const timeline = reduceJournalEntries([entry({ direction: 'bot', kind: 'uncaptured', method: 'deleteMessage' })]);
    expect(timeline.items).toEqual([{ kind: 'note', order: 0, method: 'deleteMessage', at: '2026-07-23T10:00:00.000Z' }]);
  });

  it('folds a WhatsApp-shaped exchange (version always 0, no actions) into separate bubbles, never edited in place', () => {
    // Mirrors WhatsAppCodec: no reply_markup, no editMessageText — every bot
    // turn is a brand-new messageId at version 0, unlike Telegram's
    // edit-in-place greeting. This is the demo's core "watch the UX differ"
    // claim, pinned at the pure-fold level (see WhatsAppCodec's own doc
    // comment for why version is always 0).
    const timeline = reduceJournalEntries([
      entry({ direction: 'bot', messageId: 1, version: 0, text: 'Choose your language: 1) English 2) Español', method: 'sendMessage' }),
      entry({ direction: 'user', messageId: 2, version: 0, text: '1' }),
      entry({ direction: 'bot', messageId: 3, version: 0, text: 'Howdy stranger', method: 'sendMessage' })
    ]);

    expect(timeline.items).toHaveLength(3);
    for (const item of timeline.items) {
      expect(item.kind === 'bubble' ? item.edited : false).toBe(false);
    }
    expect(timeline.items.map((item) => (item.kind === 'bubble' ? item.actions : undefined))).toEqual([
      undefined,
      undefined,
      undefined
    ]);
  });

  it('folds a full greetbot-like exchange in the same shape session.test.ts exercises', () => {
    const timeline = reduceJournalEntries([
      entry({ direction: 'user', messageId: 1, text: '/start' }),
      entry({
        direction: 'bot',
        messageId: 2,
        text: 'Choose your language',
        method: 'sendMessage',
        actions: [
          [{ label: 'English', id: 'lang:en', url: '' }],
          [{ label: 'Español', id: 'lang:es', url: '' }]
        ]
      }),
      entry({ direction: 'user', kind: 'action', refMessageId: 2, text: 'lang:en' }),
      entry({ direction: 'bot', messageId: 2, version: 1, text: 'Howdy stranger', method: 'editMessageText' }),
      entry({ direction: 'user', messageId: 5, text: 'Thanks!' }),
      entry({ direction: 'bot', messageId: 6, text: 'Howdy stranger', method: 'sendMessage' })
    ]);

    expect(timeline.items).toHaveLength(4); // /start, greeting (edited in place), thanks, reply — the click adds no bubble
    expect(timeline.items.map((item) => (item.kind === 'bubble' ? item.messageId : -1))).toEqual([1, 2, 5, 6]);
    expect(timeline.items[1]).toMatchObject({ messageId: 2, text: 'Howdy stranger', version: 1, edited: true });
    expect(timeline.pressedActionIds.get(2)?.has('lang:en')).toBe(true);
  });
});
