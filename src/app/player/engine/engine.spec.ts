import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBundleText } from '../model/parse-bundle';
import { Bundle, BundleRun } from '../model/bundle.types';
import { buildTimeline, chaptersOf } from './timeline';
import { settledStateAt } from './settled';
import { aiCursorAt } from './ai-cursor';
import {
  attribution,
  deriveMarkers,
  loopEventForBotMessage,
  messageLineage,
  resolveAnnotations,
  threadAnnotations
} from './derive';

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, '../testdata/golden.chatwright.json');

function loadSample(): Bundle {
  const result = parseBundleText(readFileSync(samplePath, 'utf8'));
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.bundle;
}

function firstRun(bundle: Bundle): BundleRun {
  const run = bundle.runs?.[0];
  if (!run) {
    throw new Error('sample bundle has no runs');
  }
  return run;
}

describe('parseBundle', () => {
  it('reads the golden sample bundle', () => {
    const result = parseBundleText(readFileSync(samplePath, 'utf8'));
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown format with a friendly error, never throwing', () => {
    const result = parseBundleText(JSON.stringify({ format: 'https://example.com/other', runs: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unknown format');
    }
  });

  it('reports invalid JSON as a friendly error', () => {
    const result = parseBundleText('{not json');
    expect(result.ok).toBe(false);
  });

  it('tolerates a future run-bundle version with a warning', () => {
    const result = parseBundleText(
      JSON.stringify({
        format: 'https://chatwright.dev/formats/run-bundle/v2',
        metadata: { createdAt: '' },
        runs: []
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  // The click-validation outcome (fresh/stale) was renamed from "verdict" to
  // "freshness" on the wire — "verdict" is now reserved for the AI-judged-
  // assertion outcome (chatwright/chatwright glossary). A runtime pre-dating
  // that rename still writes "verdict"; these two cases prove the player
  // reads both, so an existing recording (this repository's own bundled
  // samples and golden fixtures included) keeps rendering unchanged.
  function bundleWithOneValidation(validation: Record<string, unknown>): string {
    return JSON.stringify({
      format: 'https://chatwright.dev/formats/run-bundle/v1',
      metadata: { createdAt: '2026-01-01T00:00:00Z' },
      runs: [
        {
          id: 'r1',
          platform: 'telegram',
          endpointProfile: 'platform-emulated',
          actors: [],
          chats: [],
          parts: [
            {
              id: 'p1',
              kind: 'ai-goal',
              journalBoundary: { chats: [] },
              aiGoal: {
                goal: { id: 'g1', title: '', description: '', tasks: [], constraints: null, budgets: {} },
                actorId: 'a1',
                events: [
                  {
                    index: 0,
                    at: '2026-01-01T00:00:00Z',
                    taskId: 't1',
                    observationSequence: 1,
                    proposal: { kind: 'click', text: '', actionId: 'a', observationSequence: 1, rationale: '' },
                    usage: { model: '', inputTokens: 0, outputTokens: 0, latencyNanoseconds: 0 },
                    validation,
                    action: { kind: 'skipped-invalid', detail: '' }
                  }
                ],
                observations: [],
                report: {
                  schemaVersion: 1,
                  goalId: 'g1',
                  goalTitle: '',
                  stopReason: '',
                  steps: 1,
                  elapsedNanoseconds: 0,
                  tasks: [],
                  findings: [],
                  usage: { inputTokens: 0, outputTokens: 0, callCount: 0 }
                }
              }
            }
          ]
        }
      ]
    });
  }

  it('backfills freshness from a pre-rename bundle whose validation only carries "verdict"', () => {
    const result = parseBundleText(bundleWithOneValidation({ checked: true, verdict: 'stale', reason: 'no longer available' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const validation = firstRun(result.bundle).parts?.[0]?.aiGoal?.events?.[0]?.validation;
      expect(validation?.freshness).toBe('stale');
    }
  });

  it('reads freshness directly from a bundle already using the current wire name', () => {
    const result = parseBundleText(bundleWithOneValidation({ checked: true, freshness: 'fresh', reason: 'action is currently available' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const validation = firstRun(result.bundle).parts?.[0]?.aiGoal?.events?.[0]?.validation;
      expect(validation?.freshness).toBe('fresh');
    }
  });

  it('rejects a legacy PascalCase (pre-normalisation) bundle with an actionable message', () => {
    const legacy = {
      format: 'https://chatwright.dev/formats/run-bundle/v1',
      metadata: { createdAt: '' },
      runs: [
        {
          id: 'r',
          platform: 'telegram',
          endpointProfile: 'platform-emulated',
          actors: [],
          chats: [
            {
              chatId: 1,
              entries: [
                {
                  Direction: 'user',
                  Kind: 'message',
                  MessageID: 1,
                  RefMessageID: 0,
                  Version: 0,
                  Text: 'Hi',
                  Actions: null,
                  Method: '',
                  At: '2026-07-22T12:00:00Z',
                  FromID: 7
                }
              ]
            }
          ],
          parts: []
        }
      ]
    };
    const result = parseBundleText(JSON.stringify(legacy));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('predates the current format');
    }
  });
});

describe('buildTimeline', () => {
  it('is deterministic — same run in, structurally identical timeline out', () => {
    const run = firstRun(loadSample());
    const a = buildTimeline(run);
    const b = buildTimeline(run);
    expect(a.length).toBe(b.length);
    expect(a.map((s) => [s.index, s.kind, s.partIndex, s.atMs])).toEqual(
      b.map((s) => [s.index, s.kind, s.partIndex, s.atMs])
    );
  });

  it('assigns contiguous ascending indexes', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    timeline.forEach((step, i) => expect(step.index).toBe(i));
  });

  it('interleaves journal entries and AI beats (both lanes present)', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    expect(timeline.some((s) => s.kind === 'journal')).toBe(true);
    expect(timeline.some((s) => s.kind === 'ai-beat')).toBe(true);
  });

  it('orders strictly by (partIndex, atMs, lane)', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      const ordered =
        prev.partIndex < curr.partIndex ||
        (prev.partIndex === curr.partIndex && prev.atMs <= curr.atMs);
      expect(ordered).toBe(true);
    }
  });

  it('handles an empty / null run without throwing', () => {
    expect(buildTimeline(null)).toEqual([]);
    expect(buildTimeline(undefined)).toEqual([]);
  });
});

describe('settledStateAt — determinism', () => {
  it('same timeline + same index → deep-equal settled state', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    for (let i = -1; i <= timeline.length; i++) {
      expect(settledStateAt(timeline, i)).toEqual(settledStateAt(timeline, i));
    }
  });

  it('reaching an index by stepping equals seeking to it directly', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    const target = timeline.length - 1;
    // "Stepping" and "seeking" both just compute settledStateAt(index); prove
    // the fold is path-independent by comparing an incremental walk's final
    // frame to a direct jump.
    let walked = settledStateAt(timeline, -1);
    for (let i = 0; i <= target; i++) {
      walked = settledStateAt(timeline, i);
    }
    expect(walked).toEqual(settledStateAt(timeline, target));
  });

  it('index < 0 is the empty pre-roll state', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    expect(settledStateAt(timeline, -1).messageCount).toBe(0);
  });

  it('folds the golden run to its final transcript (edit applied in place)', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    const final = settledStateAt(timeline, timeline.length - 1);
    const chat = final.chats.find((c) => c.chatId === 42);
    expect(chat).toBeDefined();
    const messages = chat!.items
      .filter((item): item is Extract<typeof item, { kind: 'message' }> => item.kind === 'message')
      .map((item) => item.message);
    // Two logical messages: the user "Hi" and the bot bubble edited to v1.
    expect(messages.length).toBe(2);
    const bot = messages.find((m) => m.messageId === 2)!;
    expect(bot.version).toBe(1);
    expect(bot.text).toBe('Howdy stranger');
    expect(bot.edited).toBe(true);
    // Full lineage retained: original v0 + edit v1.
    expect(bot.history.map((h) => h.version)).toEqual([0, 1]);
    expect(bot.history[0].text).toBe('Choose your language:');
  });

  it('grows monotonically in visible messages as the index advances', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    let last = 0;
    for (let i = 0; i < timeline.length; i++) {
      const count = settledStateAt(timeline, i).messageCount;
      expect(count).toBeGreaterThanOrEqual(last);
      last = count;
    }
  });

  it('records the action press against its target message', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    const final = settledStateAt(timeline, timeline.length - 1);
    const bot = final.chats
      .find((c) => c.chatId === 42)!
      .items.filter((i) => i.kind === 'message')
      .map((i) => (i as { message: { messageId: number; pressedActionIds: string[] } }).message)
      .find((m) => m.messageId === 2)!;
    expect(bot.pressedActionIds).toContain('act1');
  });
});

describe('chapters', () => {
  it('produces one chapter per part covering a contiguous index range', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    const chapters = chaptersOf(timeline);
    expect(chapters.length).toBe(1);
    expect(chapters[0].startIndex).toBe(0);
    expect(chapters[0].endIndex).toBe(timeline.length - 1);
    expect(chapters[0].kind).toBe('ai-goal');
  });
});

describe('markers', () => {
  it('derives part, task and bookmark markers, sorted by step index', () => {
    const run = firstRun(loadSample());
    const timeline = buildTimeline(run);
    const markers = deriveMarkers(run, timeline);
    expect(markers.some((m) => m.kind === 'part')).toBe(true);
    expect(markers.some((m) => m.kind === 'task')).toBe(true);
    expect(markers.some((m) => m.kind === 'bookmark' && m.title === 'Language picked')).toBe(true);
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].stepIndex).toBeGreaterThanOrEqual(markers[i - 1].stepIndex);
    }
  });
});

describe('attribution', () => {
  it('resolves FromID to a roster actor via platform identity', () => {
    const run = firstRun(loadSample());
    expect(attribution(run, 7).displayName).toBe('Explorer');
    expect(attribution(run, 1).displayName).toBe('Greetbot');
  });

  it('renders an unknown / absent FromID neutrally without throwing', () => {
    const run = firstRun(loadSample());
    expect(attribution(run, 0).actor).toBeNull();
    expect(attribution(run, 9999).actor).toBeNull();
  });
});

describe('lineage & provenance', () => {
  it('returns full version history and the action press for the bot message', () => {
    const run = firstRun(loadSample());
    const lineage = messageLineage(run, 42, 2);
    expect(lineage.versions.map((v) => v.version)).toEqual([0, 1]);
    expect(lineage.presses.length).toBe(1);
    expect(lineage.presses[0].actionId).toBe('act1');
    // The press's visible effect is the bot edit to v1.
    expect(lineage.presses[0].response?.text).toBe('Howdy stranger');
  });

  it('links a bot message to the loop event that observed it', () => {
    const run = firstRun(loadSample());
    const link = loopEventForBotMessage(run, 42, 2);
    expect(link).not.toBeNull();
    expect(link!.partIndex).toBe(0);
  });
});

describe('ai cursor', () => {
  it('reveals more events as the index advances and never regresses', () => {
    const timeline = buildTimeline(firstRun(loadSample()));
    let last = 0;
    for (let i = 0; i < timeline.length; i++) {
      const cursor = aiCursorAt(timeline, i);
      expect(cursor.revealedEventIndexes.length).toBeGreaterThanOrEqual(last);
      last = cursor.revealedEventIndexes.length;
    }
  });
});

describe('annotations', () => {
  it('threads replies under their root and resolves anchors', () => {
    const run = firstRun(loadSample());
    const timeline = buildTimeline(run);
    const pins = resolveAnnotations(run, timeline);
    expect(pins.length).toBe(2);
    expect(pins.every((p) => p.resolved)).toBe(true);
    const threads = threadAnnotations(pins);
    expect(threads.length).toBe(1);
    expect(threads[0].replies.length).toBe(1);
    expect(threads[0].replies[0].annotation.replyTo).toBe('note-1');
  });

  it('flags a dangling replyTo without dropping the annotation or crashing', () => {
    const run = firstRun(loadSample());
    const mutated: BundleRun = {
      ...run,
      annotations: [
        {
          id: 'x',
          anchor: { chatId: 42, entryIndex: 999 },
          createdAt: '',
          text: 'dangling',
          replyTo: 'does-not-exist'
        }
      ]
    };
    const timeline = buildTimeline(mutated);
    const pins = resolveAnnotations(mutated, timeline);
    expect(pins.length).toBe(1);
    expect(pins[0].resolved).toBe(false);
    expect(pins[0].danglingReply).toBe(true);
  });
});
