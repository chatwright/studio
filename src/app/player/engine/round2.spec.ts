import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBundleText } from '../model/parse-bundle';
import { Bundle, BundleRun } from '../model/bundle.types';
import { BASE_TEMPO, MAX_GAP_MS, MIN_GAP_MS, frameDelayMs } from './tempo';
import { actorStats, observedByParts } from './derive';

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, '../testdata/golden.chatwright.json');

function firstRun(): BundleRun {
  const result = parseBundleText(readFileSync(samplePath, 'utf8'));
  if (!result.ok) {
    throw new Error(result.error);
  }
  const run = (result.bundle as Bundle).runs?.[0];
  if (!run) {
    throw new Error('no run');
  }
  return run;
}

describe('tempo — rebased speed scale (round 2, item 3)', () => {
  it('1× is at least 2× slower than the raw At gap', () => {
    const gap = 1000;
    // Old 1× waited exactly `gap`; the new 1× must wait >= 2× that.
    expect(frameDelayMs(gap, 1)).toBeGreaterThanOrEqual(2 * gap);
    expect(BASE_TEMPO).toBeGreaterThanOrEqual(2);
  });

  it('each faster preset is proportionally quicker', () => {
    const gap = 1500;
    expect(frameDelayMs(gap, 0.2)).toBeCloseTo(frameDelayMs(gap, 1) / 0.2);
    expect(frameDelayMs(gap, 0.5)).toBeGreaterThan(frameDelayMs(gap, 1));
    expect(frameDelayMs(gap, 2)).toBeLessThan(frameDelayMs(gap, 1));
    expect(frameDelayMs(gap, 4)).toBeLessThan(frameDelayMs(gap, 2));
  });

  it('clamps the raw gap before applying the tempo', () => {
    expect(frameDelayMs(0, 1)).toBe(MIN_GAP_MS * BASE_TEMPO);
    expect(frameDelayMs(9_999_999, 1)).toBe(MAX_GAP_MS * BASE_TEMPO);
  });
});

describe('observedByParts (round 2, item 5)', () => {
  it('names the ai-goal part that observed a message and what it proposed next', () => {
    const run = firstRun();
    const botRows = observedByParts(run, 42, 2);
    expect(botRows.length).toBe(1);
    expect(botRows[0].partIndex).toBe(0);
    expect(botRows[0].actorName).toBe('Explorer');
    expect(botRows[0].eventIndex).toBe(1);
    expect(botRows[0].proposedNext.toLowerCase()).toContain('task done');

    const userRows = observedByParts(run, 42, 1);
    expect(userRows.length).toBe(1);
    expect(userRows[0].eventIndex).toBe(0);
    expect(userRows[0].proposedNext).toContain('Hi');
  });

  it('returns nothing for a message no AI part observed (section is then omitted)', () => {
    const run = firstRun();
    expect(observedByParts(run, 42, 9999)).toEqual([]);
  });
});

describe('actorStats (round 2, item 1)', () => {
  it('computes per-actor stats from the bundle', () => {
    const run = firstRun();
    const explorer = run.actors!.find((a) => a.id === 'explorer')!;
    const stats = actorStats(run, explorer);
    expect(stats.messagesSent).toBe(1); // "Hi"
    expect(stats.clicks).toBe(1); // pressed act1
    expect(stats.editsReceived).toBe(1); // bot edited its message in explorer's chat
    expect(stats.isAI).toBe(true);
    expect(stats.calls).toBe(2);
    expect(stats.inputTokens).toBe(5);
    expect(stats.outputTokens).toBe(2);
    expect(stats.models).toContain('claude-haiku-4-5');
  });

  it('a bot actor sends but receives no edits of its own', () => {
    const run = firstRun();
    const bot = run.actors!.find((a) => a.id === 'bot')!;
    const stats = actorStats(run, bot);
    expect(stats.messagesSent).toBe(1);
    expect(stats.clicks).toBe(0);
    expect(stats.editsReceived).toBe(0);
    expect(stats.isAI).toBe(false);
  });
});
