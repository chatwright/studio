import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bundle, BundleRun, PlatformJournalEntry } from '@chatwright/player-core';
import { parseBundleText } from './model/parse-bundle';
import { PlayerEngine, SPEED_STOPS } from './player-engine';

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, './testdata/golden.chatwright.json');

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
    expect(engine.messageBarTyping()).toBeNull();
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

/**
 * Regression coverage for the landing-hero embed-autoplay freeze
 * (chatwright.dev/studio/player?embed=1&autoplay=1&sample=...): production
 * reproduction showed the transport stuck at "0/N" with a Pause icon
 * (isPlaying=true) forever, and manual pause/play unable to recover it.
 * Root cause traced to PlayerComponent's bundle-load effect re-running with
 * the *same* bundle reference under zoneless change detection, re-invoking
 * `engine.load()` (which unconditionally resets stepIndex to -1) every time
 * — a component-level fix (dedup on bundle identity, not testable here; this
 * repo runs the engine without Angular's TestBed/DOM, see vitest.config.ts).
 *
 * `play()` deferring and re-anchoring is this file's engine-level half of
 * the fix: a defensive backstop so play() called before a timeline exists
 * (the scenario the bug first looked like) can never strand the transport
 * either, regardless of what called it or when.
 */
describe('PlayerEngine — deferred play() re-anchors once a timeline arrives (regression: embed autoplay race)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('play() before any bundle is loaded defers instead of no-op-ing, then starts for real once load() provides a timeline', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    // Reduced motion so advanceTo() never reaches for requestAnimationFrame
    // (this suite runs the engine in plain Node — see vitest.config.ts);
    // orthogonal to the deferred-play behaviour under test.
    engine.setReducedMotion(true);

    // Nothing loaded yet — play() must not silently do nothing forever, but
    // it must also not claim to be playing when there is genuinely nothing
    // to play (that mismatch is exactly what read as "frozen" in production).
    engine.play();
    expect(engine.isPlaying()).toBe(false);
    expect(engine.stepCount()).toBe(0);

    // The bundle "arrives" — e.g. an async sample fetch resolving after the
    // autoplay request, or the effect race that triggered the production
    // bug. The deferred play() re-anchors against the real timeline.
    engine.load(loadSample(), 0);
    expect(engine.isPlaying()).toBe(true);
    expect(engine.stepCount()).toBeGreaterThan(0);

    // And it actually advances — the original bug's defining symptom was a
    // step counter frozen at its pre-roll value forever.
    vi.advanceTimersByTime(15_000);
    expect(engine.stepIndex()).toBeGreaterThan(-1);
  });

  it('pause() cancels a deferred play() so a later load() does not autoplay unexpectedly', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();

    engine.play();
    expect(engine.isPlaying()).toBe(false); // deferred

    engine.pause();
    engine.load(loadSample(), 0);
    expect(engine.isPlaying()).toBe(false); // the deferred intent was cancelled
  });

  it('play() while already playing a loaded run behaves exactly as before (no regression on the common path)', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.setReducedMotion(true);
    engine.load(loadSample(), 0);

    engine.play();
    expect(engine.isPlaying()).toBe(true);
    vi.advanceTimersByTime(15_000);
    expect(engine.stepIndex()).toBeGreaterThan(-1);
  });
});

/* ---------------------------------------------------- multi-chat runs */

function msg(chatId: number, id: number, from: number, dir: 'user' | 'bot', text: string, at: string): PlatformJournalEntry {
  return {
    direction: dir,
    kind: 'message',
    messageId: id,
    refMessageId: 0,
    version: 0,
    text,
    actions: null,
    method: '',
    at,
    fromId: from
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

describe('PlayerEngine — shared presentation transport (barriers and caller-owned waits)', () => {
  function configuredEngine(barrierIndex = 2): PlayerEngine {
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'brief', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: [{ id: 'result', segmentId: 'brief', atIndex: barrierIndex }]
    });
    return engine;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops playback at a declared barrier and keeps waiting while idle', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.play();

    vi.advanceTimersByTime(20_000);
    expect(engine.stepIndex()).toBe(2);
    expect(engine.waiting()).toBe(true);
    expect(engine.isPlaying()).toBe(true);
    const ticket = engine.wait();
    expect(ticket?.barrierId).toBe('result');

    // Nothing else may advance presentation, however long the host waits.
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(2);
    expect(engine.wait()).toBe(ticket);
  });

  it('a validated release resumes running playback exactly once inside the segment', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.play();
    vi.advanceTimersByTime(20_000);
    const ticket = engine.wait()!;

    expect(engine.releasePresentationWait(ticket)).toBe(true);
    expect(engine.wait()).toBeNull();
    expect(engine.releasePresentationWait(ticket)).toBe(false);

    vi.advanceTimersByTime(2_000);
    expect(engine.stepIndex()).toBeGreaterThan(2);
    expect(engine.wait()).toBeNull();
    expect(engine.isPlaying()).toBe(true);
  });

  it('pause while waiting retains the ticket, and a paused release does not restart playback', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.play();
    vi.advanceTimersByTime(20_000);
    const ticket = engine.wait()!;
    engine.pause();

    expect(engine.wait()).toBe(ticket);
    expect(engine.isPlaying()).toBe(false);

    expect(engine.releasePresentationWait(ticket)).toBe(true);
    expect(engine.releasePresentationWait(ticket)).toBe(false);
    expect(engine.wait()).toBeNull();
    expect(engine.isPlaying()).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(2, 'release while paused advances nothing');

    engine.play();
    vi.advanceTimersByTime(20_000);
    expect(engine.stepIndex()).toBeGreaterThan(2);
  });

  it('seek revokes the open ticket and a cancelled callback delivered later cannot move the state', () => {
    const engine = configuredEngine();
    const callbacks: Array<() => void> = [];
    const spy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void) => {
        callbacks.push(callback);
        return 4242 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    try {
      engine.play();
      expect(callbacks).toHaveLength(1);
      engine.seekTo(4);
      expect(engine.wait()).toBeNull();
      expect(engine.stepIndex()).toBe(4);

      callbacks[0]();
      expect(engine.stepIndex()).toBe(4, 'late callback did not advance');
      expect(engine.wait()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('a seek ahead then Play still consults the first open barrier', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.seekTo(5);
    expect(engine.wait()).toBeNull();

    engine.play();
    vi.advanceTimersByTime(20_000);
    expect(engine.stepIndex()).toBe(2);
    expect(engine.waiting()).toBe(true);
  });

  it('manual Next cannot substitute for validation, and Next/Skip-style stepping stays at the barrier', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.play();
    vi.advanceTimersByTime(20_000);
    const ticket = engine.wait()!;

    engine.next();
    expect(engine.stepIndex()).toBe(2);
    expect(engine.wait()).toBe(ticket);

    engine.prev();
    expect(engine.wait()).toBeNull();
    expect(engine.stepIndex()).toBe(1);
  });

  it('a changed load or context revokes the previous ticket', () => {
    vi.useFakeTimers();
    const engine = configuredEngine();
    engine.play();
    vi.advanceTimersByTime(20_000);
    const ticket = engine.wait()!;

    engine.setPresentationPlan(null);
    expect(engine.wait()).toBeNull();
    expect(engine.releasePresentationWait(ticket)).toBe(false);

    engine.next();
    expect(engine.stepIndex()).toBe(0, 'ordinary unsegmented playback is unaffected');
  });

  it('segment end awaits an explicit outer Next and never changes segment implicitly', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [
        { id: 'one', startIndex: 0, endIndex: 3 },
        { id: 'two', startIndex: 4, endIndex: engine.lastIndex() }
      ],
      barriers: []
    });

    engine.play();
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(3);
    expect(engine.isPlaying()).toBe(false);

    engine.next();
    expect(engine.stepIndex()).toBe(3);

    engine.enterPresentationSegment('two');
    expect(engine.stepIndex()).toBe(4);
    expect(engine.isPlaying()).toBe(false);
    engine.play();
    vi.advanceTimersByTime(5_000);
    expect(engine.stepIndex()).toBeGreaterThan(4);
  });

  it('keeps host-owned typing frames and their cancellation while using the shared transport', () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    const cancelled: number[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id);
    });

    try {
      const engine = new PlayerEngine();
      engine.load(loadSample(), 0);
      engine.play();
      vi.advanceTimersByTime(1_000);
      expect(engine.stepIndex()).toBe(0);
      expect(engine.animatingIndex()).toBe(0);
      expect(engine.messageBarTyping()?.chars).toBe(0);
      expect(frames).toHaveLength(1);

      engine.pause();
      expect(engine.messageBarTyping()).toBeNull();
      expect(cancelled).toContain(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps empty-barrier and ordinary transport behaviour intact', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'all', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: []
    });

    engine.next();
    expect(engine.stepIndex()).toBe(0);
    engine.prev();
    expect(engine.stepIndex()).toBe(-1);
    engine.play();
    vi.advanceTimersByTime(60_000);
    expect(engine.isPlaying()).toBe(false);
    expect(engine.stepIndex()).toBe(engine.lastIndex());

    engine.restart();
    expect(engine.stepIndex()).toBe(-1);
    engine.seekTo(engine.lastIndex());
    expect(engine.settled().messageCount).toBeGreaterThan(0);
  });
});

describe('PlayerEngine — final-index waits, retained plan bindings and atomic context changes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function engineWithFinalBarrier(): PlayerEngine {
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'all', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: [{ id: 'final-gate', segmentId: 'all', atIndex: engine.lastIndex() }]
    });
    return engine;
  }

  function engineWaitingAt(index = 2): PlayerEngine {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'all', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: [{ id: 'gate', segmentId: 'all', atIndex: index }]
    });
    engine.play();
    vi.advanceTimersByTime(20_000);
    expect(engine.waiting()).toBe(true);
    return engine;
  }

  it('pause then play at a live final-index wait preserves the cursor and exact ticket', () => {
    vi.useFakeTimers();
    const engine = engineWithFinalBarrier();
    engine.play();
    vi.advanceTimersByTime(60_000);
    expect(engine.waiting()).toBe(true);
    expect(engine.stepIndex()).toBe(engine.lastIndex());
    const ticket = engine.wait()!;
    const cursor = engine.stepIndex();

    engine.pause();
    engine.play();

    expect(engine.isPlaying()).toBe(true);
    expect(engine.stepIndex()).toBe(cursor);
    expect(engine.wait()).toBe(ticket);
    vi.advanceTimersByTime(60_000);
    expect(engine.wait()).toBe(ticket);
    expect(engine.stepIndex()).toBe(cursor);
  });

  it('a release while paused at a final-index wait only satisfies it', () => {
    vi.useFakeTimers();
    const engine = engineWithFinalBarrier();
    engine.play();
    vi.advanceTimersByTime(60_000);
    const ticket = engine.wait()!;
    const cursor = engine.stepIndex();

    engine.pause();
    expect(engine.releasePresentationWait(ticket)).toBe(true);
    expect(engine.releasePresentationWait(ticket)).toBe(false);
    expect(engine.wait()).toBeNull();
    expect(engine.isPlaying()).toBe(false);
    expect(engine.stepIndex()).toBe(cursor);
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(cursor, 'release while paused schedules nothing');

    // Finishing the released wait stays in this segment, including on Play.
    engine.play();
    expect(engine.stepIndex()).toBe(cursor);
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(cursor);
    expect(engine.wait()).toBeNull();
    expect(engine.isPlaying()).toBe(false);

    engine.play();
    expect(engine.stepIndex()).toBe(cursor, 'Play cannot enter another segment');
    expect(engine.isPlaying()).toBe(false);
  });

  it('ordinary unsegmented playback still restarts at the physical end', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.seekTo(engine.lastIndex());

    engine.play();
    expect(engine.stepIndex()).toBe(-1);
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(engine.lastIndex());
    expect(engine.isPlaying()).toBe(false);
  });

  it('Play after seeking to a segment end beyond an unresolved barrier still waits', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'all', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: [{ id: 'gate', segmentId: 'all', atIndex: 2 }]
    });
    engine.seekTo(engine.lastIndex());
    expect(engine.wait()).toBeNull();

    engine.play();
    vi.advanceTimersByTime(60_000);
    expect(engine.stepIndex()).toBe(2);
    expect(engine.waiting()).toBe(true);
    expect(engine.wait()?.barrierId).toBe('gate');
  });

  it('Play in a one-step segment whose only index is a barrier reaches waiting', () => {
    vi.useFakeTimers();
    const engine = new PlayerEngine();
    engine.load({
      format: 'https://chatwright.dev/formats/run-bundle/v1',
      metadata: { createdAt: '' },
      runs: [
        {
          id: 'one-step',
          platform: 'telegram',
          endpointProfile: 'platform-emulated',
          actors: null,
          chats: [
            {
              chatId: 1,
              entries: [msg(1, 1, 10, 'user', 'hi', '2026-01-01T00:00:00Z')]
            }
          ],
          parts: [
            {
              id: 'p',
              kind: 'deterministic',
              journalBoundary: { chats: [{ chatId: 1, firstEntry: 0, entryCount: 1 }] }
            }
          ]
        }
      ]
    });
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'only', startIndex: 0, endIndex: 0 }],
      barriers: [{ id: 'gate', segmentId: 'only', atIndex: 0 }]
    });
    engine.enterPresentationSegment('only');
    expect(engine.stepIndex()).toBe(0);
    expect(engine.waiting()).toBe(false);

    engine.play();
    vi.advanceTimersByTime(2_000);
    expect(engine.stepIndex()).toBe(0);
    expect(engine.waiting()).toBe(true);
    expect(engine.wait()?.barrierId).toBe('gate');
  });

  it('snapshots caller plan bindings so later mutation cannot retarget an immediate wait', () => {
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    const last = engine.lastIndex();
    const plan = {
      segments: [{ id: 'all', startIndex: 0, endIndex: last }],
      barriers: [{ id: 'gate', segmentId: 'all', atIndex: 2 }]
    };
    engine.setPresentationPlan(plan);

    plan.barriers[0].atIndex = 0;
    plan.segments[0].endIndex = 0;

    engine.next();
    expect(engine.stepIndex()).toBe(0);
    expect(engine.wait()).toBeNull();
    engine.next();
    engine.next();
    expect(engine.wait()?.atIndex).toBe(2);
  });

  it('snapshots caller plan bindings across a later selectRun rebuild', () => {
    const engine = new PlayerEngine();
    engine.load(loadSample(), 0);
    engine.setReducedMotion(true);
    const last = engine.lastIndex();
    const plan = {
      segments: [{ id: 'all', startIndex: 0, endIndex: last }],
      barriers: [{ id: 'gate', segmentId: 'all', atIndex: 2 }]
    };
    engine.setPresentationPlan(plan);

    plan.barriers[0].atIndex = 0;
    plan.segments[0].endIndex = 1;

    engine.selectRun(0);
    expect(engine.stepIndex()).toBe(-1);
    engine.next();
    expect(engine.stepIndex()).toBe(0);
    expect(engine.wait()).toBeNull();
    engine.next();
    engine.next();
    expect(engine.wait()?.atIndex).toBe(2);
  });

  it('refuses an incompatible load atomically and keeps the prior context coherent', () => {
    const engine = engineWaitingAt(2);
    const ticket = engine.wait()!;
    const beforeBundle = engine.bundle();
    const beforeTimeline = engine.timeline();
    const beforeRunIndex = engine.runIndex();
    const beforeCursor = engine.stepIndex();
    const incompatible = loadSample();
    incompatible.runs[0] = { ...incompatible.runs[0], parts: [] };

    expect(() => engine.load(incompatible, 0)).toThrow(RangeError);

    expect(engine.bundle()).toBe(beforeBundle);
    expect(engine.timeline()).toBe(beforeTimeline);
    expect(engine.runIndex()).toBe(beforeRunIndex);
    expect(engine.stepIndex()).toBe(beforeCursor);
    expect(engine.wait()).toBe(ticket);
    expect(engine.releasePresentationWait(ticket)).toBe(true);
  });

  it('refuses an incompatible selectRun atomically', () => {
    const bundle = loadSample();
    const engine = new PlayerEngine();
    engine.load(bundle, 0);
    engine.setReducedMotion(true);
    engine.setPresentationPlan({
      segments: [{ id: 'all', startIndex: 0, endIndex: engine.lastIndex() }],
      barriers: [{ id: 'gate', segmentId: 'all', atIndex: 2 }]
    });
    const beforeTimeline = engine.timeline();
    const beforeCursor = engine.stepIndex();
    bundle.runs.push({ ...bundle.runs[0], id: 'empty-run', parts: [] });

    expect(() => engine.selectRun(1)).toThrow(RangeError);

    expect(engine.runIndex()).toBe(0);
    expect(engine.timeline()).toBe(beforeTimeline);
    expect(engine.stepIndex()).toBe(beforeCursor);
  });

  it('refuses an incompatible patchRun atomically', () => {
    const engine = engineWaitingAt(2);
    const ticket = engine.wait()!;
    const beforeBundle = engine.bundle();
    const beforeTimeline = engine.timeline();
    const beforeCursor = engine.stepIndex();
    const run = engine.run()!;

    expect(() => engine.patchRun({ ...run, parts: [] })).toThrow(RangeError);

    expect(engine.bundle()).toBe(beforeBundle);
    expect(engine.timeline()).toBe(beforeTimeline);
    expect(engine.stepIndex()).toBe(beforeCursor);
    expect(engine.wait()).toBe(ticket);
  });

  it('a cancelled frame callback cannot mutate a newly admitted context', () => {
    const callbacks: Array<() => void> = [];
    const spy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void) => {
        callbacks.push(callback);
        return 4242 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    try {
      const engine = new PlayerEngine();
      engine.load(loadSample(), 0);
      engine.setReducedMotion(true);
      engine.play();
      expect(callbacks).toHaveLength(1);

      const replacement = loadSample();
      engine.load(replacement, 0);
      expect(engine.stepIndex()).toBe(-1);

      callbacks[0]();
      expect(engine.stepIndex()).toBe(-1, 'the old callback cannot advance the new context');
      expect(engine.wait()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

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
