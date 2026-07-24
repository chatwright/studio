/**
 * Test-only, in-process greetbot double for this app's own zero-network
 * specs. `@chatwright/runtime` ships an equivalent (`testkit/greetbot-
 * bot.ts`'s `GreetbotBot`) but that module is explicitly "not part of the
 * public API — not re-exported from index.ts", so it is not importable from
 * `@chatwright/runtime` here; this is a small, independent re-implementation
 * of the same `/start` → language picker → in-place-edited greeting
 * behaviour, driven synchronously over a `BotTransport` exactly as the real
 * greetbot iframe bot is (mirrors the Go `examples/greetbot` behaviour the
 * real bot and the vendored testkit both implement).
 *
 * English is listed first (row 0, col 0) so a spec can predict its
 * Chatwright-synthetic action id (`act-2-0-r0c0` — see
 * `@chatwright/runtime`'s `observe/engine.ts`: `act-<msgId>-<version>-
 * r<row>c<col>`. `TelegramCodec` reserves message ids from one counter
 * SHARED across both directions per chat, so a fresh chat's first bot
 * message is messageId 2 — the user's own `/start` already consumed
 * messageId 1 — both at version 0) well enough to script a
 * `ScriptedProvider`'s click proposal without first driving a live bot to
 * discover it.
 */

import type { BotCall, BotTransport } from '@chatwright/runtime';

interface TelegramInlineKeyboardButton {
  readonly text: string;
  readonly callback_data?: string;
}

interface TelegramInlineKeyboardMarkup {
  readonly inline_keyboard: readonly (readonly TelegramInlineKeyboardButton[])[];
}

interface TelegramUpdate {
  readonly message?: { readonly chat: { readonly id: number }; readonly text: string };
  readonly callback_query?: {
    readonly id: string;
    readonly data: string;
    readonly message: { readonly chat: { readonly id: number }; readonly message_id: number };
  };
}

const LANG_PREFIX = 'lang:';
const LANGUAGES: readonly { readonly code: string; readonly label: string; readonly greeting: string }[] = [
  { code: 'en', label: 'English', greeting: 'Howdy stranger' },
  { code: 'es', label: 'Español', greeting: '¡Hola, forastero!' }
];

function greetingFor(code: string): string {
  return (LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]!).greeting;
}

function languageKeyboard(): TelegramInlineKeyboardMarkup {
  return { inline_keyboard: LANGUAGES.map((language) => [{ text: language.label, callback_data: `${LANG_PREFIX}${language.code}` }]) };
}

/** A minimal, real greetbot with per-chat language state, driven synchronously over a `BotTransport` — see this module's doc comment. */
export class FakeGreetbotBot implements BotTransport {
  #handler: ((call: BotCall) => void) | undefined;
  readonly #results = new Map<string, unknown>();
  #callSeq = 0;
  readonly #language = new Map<number, string>();

  onCall(handler: (call: BotCall) => void): void {
    this.#handler = handler;
  }

  respond(id: string, result: unknown): void {
    this.#results.set(id, result);
  }

  deliverUpdate(update: unknown): void {
    const parsed = update as TelegramUpdate;
    if (parsed.message !== undefined) {
      this.#onMessage(parsed.message.chat.id, parsed.message.text);
    } else if (parsed.callback_query !== undefined) {
      this.#onCallback(
        parsed.callback_query.message.chat.id,
        parsed.callback_query.message.message_id,
        parsed.callback_query.id,
        parsed.callback_query.data
      );
    }
  }

  close(): void {
    this.#handler = undefined;
  }

  #onMessage(chatId: number, text: string): void {
    if (text === '/start') {
      this.#call('sendMessage', { chat_id: chatId, text: 'Choose your language', reply_markup: languageKeyboard() });
      return;
    }
    this.#call('sendMessage', { chat_id: chatId, text: greetingFor(this.#language.get(chatId) ?? 'en') });
  }

  #onCallback(chatId: number, messageId: number, callbackId: string, data: string): void {
    if (data.startsWith(LANG_PREFIX)) {
      const code = data.slice(LANG_PREFIX.length);
      this.#language.set(chatId, code);
      this.#call('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: greetingFor(code),
        reply_markup: languageKeyboard()
      });
    }
    this.#call('answerCallbackQuery', { callback_query_id: callbackId });
  }

  #call(method: string, params: unknown): unknown {
    if (this.#handler === undefined) {
      throw new Error('FakeGreetbotBot: not registered with a session yet');
    }
    const id = `fake-greetbot-${++this.#callSeq}`;
    this.#handler({ id, method, payload: params });
    const result = this.#results.get(id);
    this.#results.delete(id);
    return result;
  }
}
