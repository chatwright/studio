import { BeatKind, Step } from './timeline';

/**
 * The mind panel is synchronised to playback: at any step index we need the
 * active AI part, which loop event/beat is current, and which events have been
 * revealed so far. Pure derivation over the timeline.
 */
export interface AiCursor {
  /** Part index of the current step (whether ai-goal or not). */
  activePartIndex: number;
  /** Is the current part an ai-goal part? */
  aiActive: boolean;
  /** Last revealed event index within the active ai part, or -1. */
  activeEventIndex: number;
  /** Last revealed beat, or null. */
  activeBeat: BeatKind | null;
  /** Event indexes (within active part) that have at least one beat revealed. */
  revealedEventIndexes: number[];
}

export function aiCursorAt(timeline: Step[], index: number): AiCursor {
  let activePartIndex = -1;
  // Current part = part of the last step at or before index (or first part).
  for (const step of timeline) {
    if (step.index <= index) {
      activePartIndex = step.partIndex;
    } else {
      break;
    }
  }
  if (activePartIndex < 0 && timeline.length > 0) {
    activePartIndex = timeline[0].partIndex;
  }

  const revealed = new Set<number>();
  let activeEventIndex = -1;
  let activeBeat: BeatKind | null = null;

  for (const step of timeline) {
    if (step.kind !== 'ai-beat' || step.partIndex !== activePartIndex) {
      continue;
    }
    if (step.index <= index) {
      revealed.add(step.eventIndex);
      activeEventIndex = step.eventIndex;
      activeBeat = step.beat;
    }
  }

  return {
    activePartIndex,
    aiActive: revealed.size > 0 || hasAiBeats(timeline, activePartIndex),
    activeEventIndex,
    activeBeat,
    revealedEventIndexes: [...revealed].sort((a, b) => a - b)
  };
}

function hasAiBeats(timeline: Step[], partIndex: number): boolean {
  return timeline.some((step) => step.kind === 'ai-beat' && step.partIndex === partIndex);
}
