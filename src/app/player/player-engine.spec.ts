import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { parseBundleText } from './model/parse-bundle';
import { Bundle } from './model/bundle.types';
import { PlayerEngine } from './player-engine';

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
});
