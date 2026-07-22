import { JournalDirection, PlatformAction } from '../model/bundle.types';
import { messageKey } from './animation';
import { Step } from './timeline';

/**
 * Settled state is the fully-committed transcript at a given step index —
 * every message present, at its current version, with deletions applied. It
 * is a *pure fold* of the timeline's journal steps up to and including that
 * index; AI beats never mutate it. This purity is the determinism guarantee:
 * the same timeline and the same index always yield a deep-equal SettledState,
 * so the rendered DOM after any seek is reproducible regardless of playback
 * speed, animation, or how the index was reached (play, step, or scrub).
 */

export interface MessageVersion {
  version: number;
  text: string;
  actions: PlatformAction[][];
  entryIndex: number;
  at: string;
  timelineIndex: number;
}

export interface SettledMessage {
  key: string;
  chatId: number;
  messageId: number;
  direction: JournalDirection;
  fromId: number;
  version: number;
  text: string;
  actions: PlatformAction[][];
  edited: boolean;
  deleted: boolean;
  /** Journal entry index that produced the current version. */
  entryIndex: number;
  /** Timeline index of the mutation that produced the current version. */
  timelineIndex: number;
  /** Full version lineage seen so far (v0 → current). */
  history: MessageVersion[];
  /** Action ids pressed against this message so far (provenance/highlight). */
  pressedActionIds: string[];
}

export interface MethodNote {
  chatId: number;
  entryIndex: number;
  method: string;
  text: string;
  at: string;
  timelineIndex: number;
}

export type SettledItem =
  | { kind: 'message'; message: SettledMessage; order: number }
  | { kind: 'note'; note: MethodNote; order: number };

export interface SettledChat {
  chatId: number;
  items: SettledItem[];
}

export interface SettledState {
  chats: SettledChat[];
  /** Convenience: every visible (non-deleted) message across chats, in order. */
  messageCount: number;
}

function cloneActions(actions: PlatformAction[][] | null): PlatformAction[][] {
  return actions ? actions.map((row) => row.map((action) => ({ ...action }))) : [];
}

/**
 * Fold the timeline's journal steps with `step.index <= index` into settled
 * transcript state. `index < 0` yields the empty pre-roll state.
 */
export function settledStateAt(timeline: Step[], index: number): SettledState {
  // Per chat: ordered list of "slots" plus a message lookup by key.
  const chatOrder: number[] = [];
  const chats = new Map<
    number,
    { messages: Map<string, SettledMessage>; slots: SettledItem[] }
  >();

  const ensureChat = (chatId: number) => {
    let chat = chats.get(chatId);
    if (!chat) {
      chat = { messages: new Map(), slots: [] };
      chats.set(chatId, chat);
      chatOrder.push(chatId);
    }
    return chat;
  };

  let order = 0;

  for (const step of timeline) {
    if (step.index > index) {
      break;
    }
    if (step.kind !== 'journal') {
      continue;
    }
    const { entry, chatId, entryIndex } = step;
    const chat = ensureChat(chatId);

    if (entry.Kind === 'message') {
      const key = messageKey(chatId, entry.MessageID);
      const existing = chat.messages.get(key);
      const version: MessageVersion = {
        version: entry.Version,
        text: entry.Text,
        actions: cloneActions(entry.Actions),
        entryIndex,
        at: entry.At,
        timelineIndex: step.index
      };
      if (existing) {
        existing.version = entry.Version;
        existing.text = entry.Text;
        existing.actions = cloneActions(entry.Actions);
        existing.edited = entry.Version > 0 || existing.edited;
        existing.entryIndex = entryIndex;
        existing.timelineIndex = step.index;
        existing.deleted = false;
        existing.history.push(version);
      } else {
        const message: SettledMessage = {
          key,
          chatId,
          messageId: entry.MessageID,
          direction: entry.Direction,
          fromId: entry.FromID,
          version: entry.Version,
          text: entry.Text,
          actions: cloneActions(entry.Actions),
          edited: entry.Version > 0,
          deleted: false,
          entryIndex,
          timelineIndex: step.index,
          history: [version],
          pressedActionIds: []
        };
        chat.messages.set(key, message);
        chat.slots.push({ kind: 'message', message, order: order++ });
      }
    } else if (entry.Kind === 'action') {
      const key = messageKey(chatId, entry.RefMessageID);
      const target = chat.messages.get(key);
      if (target && entry.Text) {
        target.pressedActionIds = [...target.pressedActionIds, entry.Text];
      }
    } else if (entry.Kind === 'uncaptured') {
      const isDelete = /delete/i.test(entry.Method);
      if (isDelete && entry.RefMessageID > 0) {
        const key = messageKey(chatId, entry.RefMessageID);
        const target = chat.messages.get(key);
        if (target) {
          target.deleted = true;
          target.timelineIndex = step.index;
        }
      } else {
        chat.slots.push({
          kind: 'note',
          note: {
            chatId,
            entryIndex,
            method: entry.Method,
            text: entry.Text,
            at: entry.At,
            timelineIndex: step.index
          },
          order: order++
        });
      }
    }
  }

  const out: SettledChat[] = [];
  let messageCount = 0;
  for (const chatId of chatOrder) {
    const chat = chats.get(chatId)!;
    const items = [...chat.slots].sort((a, b) => a.order - b.order);
    for (const item of items) {
      if (item.kind === 'message' && !item.message.deleted) {
        messageCount++;
      }
    }
    out.push({ chatId, items });
  }

  return { chats: out, messageCount };
}
