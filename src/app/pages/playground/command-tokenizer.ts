/**
 * Splits a bubble's text into plain-text and `/command` segments so the
 * template can render each `/command` token as a clickable link — Telegram
 * panes only (see `chat-pane.component.html`'s use of this: real WhatsApp
 * renders `/start` as inert plain text, so this module is never consulted
 * for a WhatsApp pane).
 *
 * Pure, framework-free, no HTML in or out: the template maps this array to
 * `<button>`/text nodes itself (split-and-map), so there is never a raw
 * string blob that needs `[innerHTML]` — the one thing that would open an
 * injection risk here, given the text token in a bubble can be anything a
 * bot chooses to send.
 */

export interface CommandTextSegment {
  readonly kind: 'text';
  readonly value: string;
}

export interface CommandToken {
  readonly kind: 'command';
  readonly value: string;
}

export type CommandSegment = CommandTextSegment | CommandToken;

/**
 * `/[a-z0-9_]+` (the founder's own spec), case-insensitive, additionally
 * required to sit at a word boundary on its *left* side: not immediately
 * preceded by a word character or another `/`. That second clause is what
 * keeps this from lighting up the "/start" inside "https://start.example"
 * or "re/start" — a bare `\b` before `/` doesn't do that (`/` is already a
 * non-word character, so the standard word-boundary assertion fires in
 * exactly the wrong place, right before a slash that follows a letter).
 * The run of `[a-z0-9_]` characters is greedy, so the token's right edge is
 * already exactly the command's own boundary — no assertion needed there.
 */
const COMMAND_PATTERN = /(?<![\w/])\/[a-z0-9_]+/gi;

/** Folds `text` into an ordered list of plain-text and command segments — concatenating every `.value` back together reconstructs `text` exactly. */
export function tokenizeCommandText(text: string): readonly CommandSegment[] {
  const segments: CommandSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(COMMAND_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ kind: 'command', value: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', value: text }];
}
