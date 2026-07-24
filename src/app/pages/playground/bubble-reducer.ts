/**
 * A pure, framework-free fold over a live `@chatwright/runtime` journal's
 * entries into what the Playground chat surface renders: one bubble per
 * distinct `messageId`, edits (a later 'message' entry re-using the same
 * `messageId`, with an incremented `version`) replacing that bubble's text
 * in place rather than appending a new one — mirroring how the journal
 * itself models an edit (append-only, never a mutation; see
 * `@chatwright/runtime`'s `docs/architecture.md` "Journal seam"). An
 * `'action'` entry (a button click) never gets its own bubble — Telegram
 * doesn't create a message when a user taps an inline button — it only
 * marks that button "pressed" on the message it targeted. An
 * `'uncaptured'` entry (a bot method this runtime slice doesn't emulate)
 * becomes a plain note, never a fabricated reply — the same honesty rule
 * the runtime itself follows.
 *
 * Deliberately declared independent of `@chatwright/runtime`'s own
 * `JournalEntry`/`JournalAction` types (structurally identical, see the
 * `*Like` naming below) so this module — and its unit tests — never need
 * the vendored `@chatwright/runtime` package to resolve. A real
 * `JournalEntry[]` from the runtime satisfies `JournalEntryLike[]`
 * structurally with no cast at the call site.
 */

export type JournalDirectionLike = 'user' | 'bot';
export type JournalEntryKindLike = 'message' | 'action' | 'uncaptured';

export interface JournalActionLike {
  readonly label: string;
  readonly id: string;
  readonly url: string;
}

export interface JournalEntryLike {
  readonly direction: JournalDirectionLike;
  readonly kind: JournalEntryKindLike;
  readonly messageId: number;
  readonly refMessageId: number;
  readonly version: number;
  readonly text: string;
  readonly actions?: readonly (readonly JournalActionLike[])[];
  readonly method: string;
  readonly at: string;
  readonly fromId: number;
}

export interface PlaygroundBubble {
  readonly kind: 'bubble';
  readonly order: number;
  readonly messageId: number;
  readonly direction: JournalDirectionLike;
  readonly text: string;
  readonly version: number;
  readonly edited: boolean;
  readonly actions?: readonly (readonly JournalActionLike[])[];
  readonly at: string;
}

/** An honest placeholder for a bot call this runtime slice doesn't emulate — never a fabricated reply. */
export interface PlaygroundNote {
  readonly kind: 'note';
  readonly order: number;
  readonly method: string;
  readonly at: string;
}

export type PlaygroundTimelineItem = PlaygroundBubble | PlaygroundNote;

export interface PlaygroundTimeline {
  /** In first-appearance order; an edited bubble stays at its original position. */
  readonly items: readonly PlaygroundTimelineItem[];
  /** messageId of the clicked-on message -> the set of action ids clicked on it. */
  readonly pressedActionIds: ReadonlyMap<number, ReadonlySet<string>>;
}

const EMPTY_TIMELINE: PlaygroundTimeline = { items: [], pressedActionIds: new Map() };

/**
 * Folds a chat's journal entries (in append order, exactly as
 * `Journal.entries()`/`Journal.subscribe()` deliver them) into the
 * Playground's render model. Pure: same entries in, same timeline out —
 * safe to recompute on every entry, as the Playground page does via a
 * `computed()` over its accumulated entries signal.
 */
export function reduceJournalEntries(entries: readonly JournalEntryLike[]): PlaygroundTimeline {
  if (entries.length === 0) {
    return EMPTY_TIMELINE;
  }

  const items: PlaygroundTimelineItem[] = [];
  const indexByMessageId = new Map<number, number>();
  const pressedActionIds = new Map<number, Set<string>>();
  let orderSeq = 0;

  for (const entry of entries) {
    if (entry.kind === 'message') {
      const existingIndex = indexByMessageId.get(entry.messageId);
      if (existingIndex !== undefined) {
        const existing = items[existingIndex] as PlaygroundBubble;
        items[existingIndex] = {
          ...existing,
          text: entry.text,
          version: entry.version,
          edited: entry.version > 0,
          // Real Telegram's editMessageText clears a message's inline
          // keyboard unless the call explicitly re-sends reply_markup — it
          // never carries the previous keyboard forward (runtime-ts
          // decision 0015, docs/runtime-parity.md). TelegramCodec journals
          // that fidelity directly: entry.actions is the verbatim
          // reply_markup when the edit sent one, else undefined — so take
          // it as-is here, with no fallback to the prior version's actions.
          actions: entry.actions,
          at: entry.at
        };
        continue;
      }
      const bubble: PlaygroundBubble = {
        kind: 'bubble',
        order: orderSeq++,
        messageId: entry.messageId,
        direction: entry.direction,
        text: entry.text,
        version: entry.version,
        edited: entry.version > 0,
        actions: entry.actions,
        at: entry.at
      };
      indexByMessageId.set(entry.messageId, items.length);
      items.push(bubble);
    } else if (entry.kind === 'action') {
      // A click's `text` carries the clicked action's id (Session.submitClick
      // -> TelegramCodec.buildCallbackUpdate journals it that way).
      const pressed = pressedActionIds.get(entry.refMessageId) ?? new Set<string>();
      pressed.add(entry.text);
      pressedActionIds.set(entry.refMessageId, pressed);
    } else {
      items.push({ kind: 'note', order: orderSeq++, method: entry.method, at: entry.at });
    }
  }

  return { items, pressedActionIds };
}
