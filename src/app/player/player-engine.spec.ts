import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { parseBundleText } from './model/parse-bundle';
import { Bundle, BundleRun, PlatformJournalEntry } from './model/bundle.types';
import { PlayerEngine, SPEED_STOPS } from './player-engine';

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, '../../../public/samples/greetbot-language.chatwright.json');

function loadSample(): Bundle {
  const result = parseBundleText(readFileSync(samplePath, 'utf8'));
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.bundle;
}

describe('PlayerEngine — signal-driven transport (no timers)', () => {
  let engine: PlayerEngine;

  beforeEach(() => {
    engine = new PlayerEngine();
    engine.load(loadSample(), 0);
  });

  it('builds the timeline and starts at the empty pre-roll', () => {
    expect(engine.stepCount()).toBeGreaterThan(0);
    expect(engine.stepIndex()).toBe(-1);
    expect(engine.settled().messageCount).toBe(0);
    expect(engine.atEnd()).toBe(false);
  });

  it('next() advances one step and grows the settled transcript', () => {
    const before = engine.settled().messageCount;
    engine.next();
    expect(engine.stepIndex()).toBe(0);
    expect(engine.settled().messageCount).toBeGreaterThanOrEqual(before);
  });

  it('seeking to the last index yields the same settled state as stepping there', () => {
    const last = engine.lastIndex();
    engine.seekTo(last);
    const seeked = engine.settled();

    engine.restart();
    for (let i = 0; i <= last; i++) {
      engine.next();
    }
    expect(engine.settled()).toEqual(seeked);
    expect(engine.atEnd()).toBe(true);
  });

  it('manual stepping never leaves transient animation state set', () => {
    engine.next();
    engine.next();
    expect(engine.animatingIndex()).toBeNull();
    expect(engine.composerTyping()).toBeNull();
    engine.seekTo(engine.lastIndex());
    expect(engine.animatingIndex()).toBeNull();
    engine.prev();
    expect(engine.animatingIndex()).toBeNull();
  });

  it('clamps seeks to the valid range', () => {
    engine.seekTo(9999);
    expect(engine.stepIndex()).toBe(engine.lastIndex());
    engine.seekTo(-50);
    expect(engine.stepIndex()).toBe(-1);
  });

  it('setSpeed updates the speed signal without touching the playhead', () => {
    engine.seekTo(2);
    engine.setSpeed(4);
    expect(engine.speed()).toBe(4);
    expect(engine.stepIndex()).toBe(2);
  });

  it('reduced motion clears any transient animation state', () => {
    engine.setReducedMotion(true);
    expect(engine.reducedMotion()).toBe(true);
    expect(engine.animatingIndex()).toBeNull();
  });

  it('jumping to a marker seeks to its step and pauses', () => {
    const markers = engine.markers();
    const bookmark = markers.find((m) => m.kind === 'bookmark');
    expect(bookmark).toBeDefined();
    engine.jumpToMarker(bookmark!);
    expect(engine.stepIndex()).toBe(bookmark!.stepIndex);
    expect(engine.isPlaying()).toBe(false);
  });

  it('patchRun (e.g. after adding an annotation) rebuilds the timeline in place', () => {
    const run = engine.run()!;
    const before = engine.stepCount();
    engine.patchRun({
      ...run,
      annotations: [
        ...(run.annotations ?? []),
        { id: 'live', anchor: { chatId: 42, entryIndex: 0 }, createdAt: '', text: 'added in player' }
      ]
    });
    expect(engine.annotationPins().some((p) => p.annotation.id === 'live')).toBe(true);
    // Annotations do not add timeline steps.
    expect(engine.stepCount()).toBe(before);
  });

  it('exposes the rebased 5-stop speed scale', () => {
    expect([...SPEED_STOPS]).toEqual([0.2, 0.5, 1, 2, 4]);
  });
});

/* ---------------------------------------------------- multi-chat runs */

function msg(chatId: number, id: number, from: number, dir: 'user' | 'bot', text: string, at: string): PlatformJournalEntry {
  return {
    Direction: dir,
    Kind: 'message',
    MessageID: id,
    RefMessageID: 0,
    Version: 0,
    Text: text,
    Actions: null,
    Method: '',
    At: at,
    FromID: from
  };
}

/**
 * A real multi-chat run: user A talks to a bot in chat 100, the bot notifies
 * user B in chat 200, B acknowledges, and A's conversation continues — the
 * timeline interleaves both chats by their timestamps.
 */
function twoChatBundle(): Bundle {
  const run: BundleRun = {
    id: 'cross',
    platform: 'telegram',
    endpointProfile: 'platform-emulated',
    actors: [
      { id: 'a', type: 'human', platformIdentities: { telegram: { userId: 10 } } },
      { id: 'bot', type: 'bot', platformIdentities: { telegram: { userId: 1 } } },
      { id: 'b', type: 'human', platformIdentities: { telegram: { userId: 20 } } }
    ],
    chats: [
      {
        chatId: 100,
        entries: [
          msg(100, 1, 10, 'user', 'hi', '2026-01-01T00:00:00Z'),
          msg(100, 2, 1, 'bot', 'ok', '2026-01-01T00:00:02Z')
        ]
      },
      {
        chatId: 200,
        entries: [
          msg(200, 1, 1, 'bot', 'notify B', '2026-01-01T00:00:01Z'),
          msg(200, 2, 20, 'user', 'ack', '2026-01-01T00:00:03Z')
        ]
      }
    ],
    parts: [
      {
        id: 'p0',
        kind: 'deterministic',
        journalBoundary: {
          chats: [
            { chatId: 100, firstEntry: 0, entryCount: 2 },
            { chatId: 200, firstEntry: 0, entryCount: 2 }
          ]
        }
      }
    ]
  };
  return { format: 'https://chatwright.dev/formats/run-bundle/v1', metadata: { createdAt: '' }, runs: [run] };
}

describe('PlayerEngine — multi-chat auto-follow and pin (round 2, item 2)', () => {
  it('interleaves both chats by timestamp and follows the active chat', () => {
    const engine = new PlayerEngine();
    engine.load(twoChatBundle(), 0);
    expect(engine.chatIds()).toEqual([100, 200]);

    engine.seekTo(0); // chat 100, "hi"
    expect(engine.activeChatId()).toBe(100);
    engine.next(); // index 1 → chat 200, "notify B"
    expect(engine.activeChatId()).toBe(200);
    engine.next(); // index 2 → chat 100, "ok"
    expect(engine.activeChatId()).toBe(100);
    engine.next(); // index 3 → chat 200, "ack"
    expect(engine.activeChatId()).toBe(200);
  });

  it('a pinned chat is held while stepping; unpinning resumes auto-follow', () => {
    const engine = new PlayerEngine();
    engine.load(twoChatBundle(), 0);

    engine.setActiveChat(100);
    engine.togglePin(); // pin chat 100
    engine.seekTo(1); // step is in chat 200, but we are pinned to 100
    expect(engine.activeChatId()).toBe(100);
    expect(engine.pinnedChatId()).toBe(100);

    engine.togglePin(); // release
    engine.seekTo(1);
    expect(engine.activeChatId()).toBe(200);
  });

  it('pinChat repins to another chat instead of unpinning (round 3, item 3)', () => {
    const engine = new PlayerEngine();
    engine.load(twoChatBundle(), 0);

    engine.pinChat(100); // pin A
    expect(engine.pinnedChatId()).toBe(100);

    engine.pinChat(200); // click pin on B while A is pinned → repin to B
    expect(engine.pinnedChatId()).toBe(200);
    expect(engine.activeChatId()).toBe(200);

    engine.pinChat(200); // clicking the pinned chat's pin again releases it
    expect(engine.pinnedChatId()).toBeNull();
  });
});
