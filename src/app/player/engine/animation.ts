import { PlatformJournalEntry } from '../model/bundle.types';

/**
 * The animation layer is a first-class part of the playback engine, not a
 * cosmetic afterthought (founder: "animations are crucial for lux feel").
 *
 * Every journal mutation is mapped — declaratively and deterministically — to
 * one named animation *primitive*. The engine paces these primitives by the
 * virtual clock; the transcript/mind components are the only place the
 * primitives actually render. Crucially, a primitive is always *skippable*:
 * settled state is derived purely from the step index (see settled.ts), so
 * Prev/Next and scrubbing land on the final state instantly and never wait on
 * an animation. A primitive only plays during continuous forward playback,
 * and only when prefers-reduced-motion is off.
 */
export type AnimationPrimitive =
  /** (a) client message typed char-by-char, send-button press, bubble lands. */
  | 'compose-and-send'
  /** (b) inline-button press highlight before its callback fires. */
  | 'button-press'
  /** (c) bot "typing…" indicator before a bot bubble lands. */
  | 'bot-typing'
  /** (d) edit morph — old text crossfades to new (both versions available). */
  | 'edit-morph'
  /** (e) vapouring deletion — a message evaporates, never vanishes in a frame. */
  | 'vapour-delete'
  /** (g) reply/inline keyboard slides in with its bubble. */
  | 'reply-keyboard-in'
  /** an uncaptured Bot API method call surfaces as a subtle inline note. */
  | 'method-note'
  /** an AI loop-event beat reveals in the mind panel (observe→propose→validate→act). */
  | 'mind-reveal'
  /** no motion (e.g. a step that only advances the mind cursor). */
  | 'none';

export interface AnimationSpec {
  primitive: AnimationPrimitive;
  /** Message key (`chatId:messageId`) this primitive acts on, when applicable. */
  targetKey?: string;
  /** Nominal duration at 1× speed, in ms. Scaled by 1 / speed at play time. */
  baseDurationMs: number;
  /** For compose-and-send: the text that is typed out character by character. */
  typedText?: string;
  /** (h) subtle part-chapter boundary treatment when this is a part's first step. */
  chapterBoundary: boolean;
}

/** Bot API methods whose effect is to remove a message from the chat. */
const DELETE_METHOD = /delete/i;

export function messageKey(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`;
}

/** Base per-character typing duration at 1× (ms). Speed scaling divides this. */
export const TYPING_MS_PER_CHAR = 32;

/**
 * Map one journal entry to its animation primitive. Pure and deterministic:
 * the same entry always yields the same spec, independent of playhead, speed
 * or wall-clock. Speed only affects how fast the spec is played, never which
 * primitive is chosen.
 */
export function animationForJournalEntry(
  chatId: number,
  entry: PlatformJournalEntry,
  chapterBoundary: boolean
): AnimationSpec {
  switch (entry.kind) {
    case 'message': {
      if (entry.version > 0) {
        return {
          primitive: 'edit-morph',
          targetKey: messageKey(chatId, entry.messageId),
          baseDurationMs: 620,
          chapterBoundary
        };
      }
      if (entry.direction === 'user') {
        return {
          primitive: 'compose-and-send',
          targetKey: messageKey(chatId, entry.messageId),
          baseDurationMs: Math.min(2400, 420 + entry.text.length * TYPING_MS_PER_CHAR),
          typedText: entry.text,
          chapterBoundary
        };
      }
      // Bot message: typing indicator, then land. Keyboard slides with it.
      const hasActions = !!entry.actions && entry.actions.length > 0;
      return {
        primitive: hasActions ? 'reply-keyboard-in' : 'bot-typing',
        targetKey: messageKey(chatId, entry.messageId),
        baseDurationMs: hasActions ? 900 : 780,
        chapterBoundary
      };
    }
    case 'action':
      return {
        primitive: 'button-press',
        targetKey: messageKey(chatId, entry.refMessageId),
        baseDurationMs: 460,
        chapterBoundary
      };
    case 'uncaptured':
      if (DELETE_METHOD.test(entry.method) && entry.refMessageId > 0) {
        return {
          primitive: 'vapour-delete',
          targetKey: messageKey(chatId, entry.refMessageId),
          baseDurationMs: 720,
          chapterBoundary
        };
      }
      return { primitive: 'method-note', baseDurationMs: 360, chapterBoundary };
    default:
      return { primitive: 'none', baseDurationMs: 240, chapterBoundary };
  }
}

/** The mind-panel reveal for an AI loop-event beat. */
export function animationForBeat(chapterBoundary: boolean): AnimationSpec {
  return { primitive: 'mind-reveal', baseDurationMs: 320, chapterBoundary };
}
