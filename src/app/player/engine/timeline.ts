import {
  ActorLoopEvent,
  BundleRun,
  PlatformJournalEntry
} from '../model/bundle.types';
import { AnimationSpec, animationForBeat, animationForJournalEntry } from './animation';

/**
 * A run flattened into a single ordered list of discrete playback steps.
 *
 * The timeline is the deterministic spine of the whole engine: Prev/Next step
 * over it, the scrubber indexes into it, the virtual clock reads `atMs` off
 * it, and settled state (see settled.ts) is a pure fold of its journal steps.
 * Building a timeline from a given run is a pure function — same run in, same
 * timeline out — which is what makes "same bundle + same seek → same settled
 * DOM" hold.
 */

export type BeatKind = 'observe' | 'propose' | 'validate' | 'act';

interface StepBase {
  /** Assigned after the final sort; the index Prev/Next/seek operate on. */
  index: number;
  /** Which part (chapter) this step belongs to. */
  partIndex: number;
  partId: string;
  partTitle: string;
  partKind: string;
  /** Virtual-clock time in ms since epoch (NaN-safe: missing → previous). */
  atMs: number;
  /** Raw `At` string for display. */
  at: string;
  animation: AnimationSpec;
}

export interface JournalStep extends StepBase {
  kind: 'journal';
  chatId: number;
  /** Index into that chat's `entries` array. */
  entryIndex: number;
  entry: PlatformJournalEntry;
}

export interface BeatStep extends StepBase {
  kind: 'ai-beat';
  beat: BeatKind;
  /** Index into the part's aiGoal.events. */
  eventIndex: number;
  event: ActorLoopEvent;
  /** The observation sequence the actor observed for this event. */
  observationSequence: number;
}

export type Step = JournalStep | BeatStep;

/** Journal steps sort before AI beats at an identical timestamp (transcript spine leads). */
const LANE_JOURNAL = 0;
const LANE_AI = 1;

interface Candidate {
  step: Step;
  lane: number;
  /** Monotonic construction order; the final, total tiebreak. */
  seq: number;
}

/**
 * Milliseconds-since-epoch for an `At` timestamp, preserving sub-millisecond
 * precision. `Date.parse` truncates the fractional seconds to milliseconds,
 * which collapses the true order of events stamped within the same millisecond
 * (bundles routinely carry microsecond precision). We recover the digits beyond
 * the first three and add them as a fractional millisecond, so the timeline
 * orders faithfully by real event time.
 */
function parseAtMs(at: string, fallback: number): number {
  const base = Date.parse(at);
  if (!Number.isFinite(base)) {
    return fallback;
  }
  const fraction = /T\d{2}:\d{2}:\d{2}[.,](\d+)/.exec(at)?.[1];
  if (fraction && fraction.length > 3) {
    const sub = Number(`0.${fraction.slice(3)}`);
    if (Number.isFinite(sub)) {
      return base + sub;
    }
  }
  return base;
}

/**
 * Build the ordered step list for one run.
 *
 * Ordering key (documented, fully deterministic):
 *   [partIndex, atMs, laneRank(journal<ai), constructionSeq]
 *
 * Part order is authoritative (parts are chapters); within a part, steps run
 * by their `At` timestamp (parsed with sub-millisecond precision — see
 * parseAtMs — so events stamped microseconds apart keep their true order). When
 * timestamps tie exactly, journal entries come before the AI beats at that
 * instant (the transcript is the spine; the reasoning about a moment follows
 * it), and construction order is the final stable tiebreak.
 */
export function buildTimeline(run: BundleRun | null | undefined): Step[] {
  if (!run) {
    return [];
  }

  const chatsById = new Map<number, PlatformJournalEntry[]>();
  for (const chat of run.chats ?? []) {
    chatsById.set(chat.chatId, chat.entries ?? []);
  }

  const candidates: Candidate[] = [];
  let seq = 0;
  let lastAtMs = 0;

  const parts = run.parts ?? [];
  parts.forEach((part, partIndex) => {
    let firstOfPart = true;

    const emitChapter = (): boolean => {
      const flag = firstOfPart;
      firstOfPart = false;
      return flag;
    };

    // Journal steps for this part, per chat boundary.
    for (const boundary of part.journalBoundary?.chats ?? []) {
      const entries = chatsById.get(boundary.chatId);
      if (!entries) {
        continue;
      }
      const start = Math.max(0, boundary.firstEntry);
      const end = Math.min(entries.length, boundary.firstEntry + boundary.entryCount);
      for (let i = start; i < end; i++) {
        const entry = entries[i];
        const atMs = parseAtMs(entry.at, lastAtMs);
        lastAtMs = atMs;
        candidates.push({
          lane: LANE_JOURNAL,
          seq: seq++,
          step: {
            kind: 'journal',
            index: -1,
            partIndex,
            partId: part.id,
            partTitle: part.title ?? part.id,
            partKind: part.kind,
            atMs,
            at: entry.at,
            chatId: boundary.chatId,
            entryIndex: i,
            entry,
            animation: animationForJournalEntry(boundary.chatId, entry, emitChapter())
          }
        });
      }
    }

    // AI loop-event beats for an ai-goal part.
    if (part.kind === 'ai-goal' && part.aiGoal?.events) {
      part.aiGoal.events.forEach((event, eventIndex) => {
        const atMs = parseAtMs(event.at, lastAtMs);
        lastAtMs = atMs;
        const beats: BeatKind[] = ['observe', 'propose'];
        if (event.validation?.checked) {
          beats.push('validate');
        }
        beats.push('act');
        for (const beat of beats) {
          candidates.push({
            lane: LANE_AI,
            seq: seq++,
            step: {
              kind: 'ai-beat',
              index: -1,
              partIndex,
              partId: part.id,
              partTitle: part.title ?? part.id,
              partKind: part.kind,
              atMs,
              at: event.at,
              beat,
              eventIndex,
              event,
              observationSequence: event.observationSequence,
              animation: animationForBeat(emitChapter())
            }
          });
        }
      });
    }
  });

  candidates.sort((a, b) => {
    const pa = a.step.partIndex - b.step.partIndex;
    if (pa !== 0) return pa;
    const ta = a.step.atMs - b.step.atMs;
    if (ta !== 0) return ta;
    const la = a.lane - b.lane;
    if (la !== 0) return la;
    return a.seq - b.seq;
  });

  return candidates.map((candidate, index) => {
    candidate.step.index = index;
    return candidate.step;
  });
}

/** Contiguous [startIndex, endIndex] step range for each part, in part order. */
export interface Chapter {
  partIndex: number;
  partId: string;
  title: string;
  kind: string;
  startIndex: number;
  endIndex: number;
}

export function chaptersOf(timeline: Step[]): Chapter[] {
  const chapters: Chapter[] = [];
  for (const step of timeline) {
    const current = chapters[chapters.length - 1];
    if (current && current.partIndex === step.partIndex) {
      current.endIndex = step.index;
      continue;
    }
    chapters.push({
      partIndex: step.partIndex,
      partId: step.partId,
      title: step.partTitle,
      kind: step.partKind,
      startIndex: step.index,
      endIndex: step.index
    });
  }
  return chapters;
}
