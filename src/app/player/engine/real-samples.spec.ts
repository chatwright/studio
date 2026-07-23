import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBundleText } from '../model/parse-bundle';
import { Bundle, BundleRun } from '../model/bundle.types';
import { buildTimeline, chaptersOf } from './timeline';
import { observedByParts } from './derive';
import { PlayerEngine } from '../player-engine';

const samplesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../public/samples');

function loadSample(file: string): Bundle {
  const result = parseBundleText(readFileSync(resolve(samplesDir, file), 'utf8'));
  if (!result.ok) {
    throw new Error(`${file}: ${result.error}`);
  }
  return result.bundle;
}

function firstRun(bundle: Bundle): BundleRun {
  const run = bundle.runs?.[0];
  if (!run) {
    throw new Error('no run');
  }
  return run;
}

describe('real sample: debt-two-chat.chatwright.json — multi-chat auto-follow', () => {
  const bundle = loadSample('debt-two-chat.chatwright.json');

  it('parses and carries two chats + a deterministic then ai-goal part', () => {
    const run = firstRun(bundle);
    expect(run.chats?.map((c) => c.chatId)).toEqual([101, 202]);
    expect(run.parts?.map((p) => p.kind)).toEqual(['deterministic', 'ai-goal']);
    const timeline = buildTimeline(run);
    expect(chaptersOf(timeline).length).toBe(2);
  });

  it('auto-follows an AI beat whose observed chat (202) differs from the preceding journal step (101)', () => {
    const engine = new PlayerEngine();
    engine.load(bundle, 0);
    const timeline = engine.timeline();

    // The acknowledge part's actor is Bob; event #1 observed chat 202 while the
    // immediately preceding journal entry (@bob acknowledged…) is in chat 101.
    const observeBeatIndex = timeline.findIndex(
      (s) => s.kind === 'ai-beat' && s.partIndex === 1 && s.eventIndex === 1 && s.beat === 'observe'
    );
    expect(observeBeatIndex).toBeGreaterThan(0);

    const prev = timeline[observeBeatIndex - 1];
    expect(prev.kind).toBe('journal');
    if (prev.kind === 'journal') {
      expect(prev.chatId).toBe(101);
    }

    engine.seekTo(observeBeatIndex - 1);
    expect(engine.activeChatId()).toBe(101); // following Alice's chat

    engine.seekTo(observeBeatIndex);
    expect(engine.activeChatId()).toBe(202); // switched to Bob's chat for the AI beat
  });

  it('follows both chats across a full sequential playthrough', () => {
    const engine = new PlayerEngine();
    engine.load(bundle, 0);
    const seen = new Set<number>();
    for (let i = 0; i <= engine.lastIndex(); i++) {
      engine.next();
      const active = engine.activeChatId();
      if (active !== null) {
        seen.add(active);
      }
    }
    expect(seen.has(101)).toBe(true);
    expect(seen.has(202)).toBe(true);
  });
});

describe('real sample: greetbot-three-part.chatwright.json — observed by two AI parts', () => {
  const bundle = loadSample('greetbot-three-part.chatwright.json');

  it('parses into three parts (deterministic + two ai-goal)', () => {
    const run = firstRun(bundle);
    expect(run.parts?.map((p) => p.kind)).toEqual(['deterministic', 'ai-goal', 'ai-goal']);
    const timeline = buildTimeline(run);
    expect(chaptersOf(timeline).length).toBe(3);
  });

  it('the edited greeting (msg 2) is observed by BOTH ai-goal parts', () => {
    const run = firstRun(bundle);
    const rows = observedByParts(run, 42, 2);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.partIndex)).toEqual([1, 2]);
    // Each row reports what that part's actor proposed next at that moment.
    expect(rows[0].proposedNext).toContain('Thanks!');
    expect(rows[1].proposedNext).toContain('/time');
  });
});
