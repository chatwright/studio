import { describe, expect, it } from 'vitest';

import { tokenizeCommandText } from './command-tokenizer';

describe('tokenizeCommandText', () => {
  it('returns the whole string as one text segment when there is no command', () => {
    expect(tokenizeCommandText('Howdy stranger!')).toEqual([{ kind: 'text', value: 'Howdy stranger!' }]);
  });

  it('turns a bare /command into a single command segment', () => {
    expect(tokenizeCommandText('/start')).toEqual([{ kind: 'command', value: '/start' }]);
  });

  it('splits text around a /command in the middle', () => {
    expect(tokenizeCommandText('Type /start to begin')).toEqual([
      { kind: 'text', value: 'Type ' },
      { kind: 'command', value: '/start' },
      { kind: 'text', value: ' to begin' }
    ]);
  });

  it('finds every /command, including consecutive ones', () => {
    expect(tokenizeCommandText('/start /help')).toEqual([
      { kind: 'command', value: '/start' },
      { kind: 'text', value: ' ' },
      { kind: 'command', value: '/help' }
    ]);
  });

  it('matches case-insensitively but preserves the original casing verbatim', () => {
    expect(tokenizeCommandText('Try /START now')).toEqual([
      { kind: 'text', value: 'Try ' },
      { kind: 'command', value: '/START' },
      { kind: 'text', value: ' now' }
    ]);
  });

  it('includes underscores and digits in the command token', () => {
    expect(tokenizeCommandText('/lang_en2 please')).toEqual([
      { kind: 'command', value: '/lang_en2' },
      { kind: 'text', value: ' please' }
    ]);
  });

  it('stops the token at trailing punctuation', () => {
    expect(tokenizeCommandText('Send /start!')).toEqual([
      { kind: 'text', value: 'Send ' },
      { kind: 'command', value: '/start' },
      { kind: 'text', value: '!' }
    ]);
  });

  it('does not treat a slash embedded in a word as a command (word-boundary rule)', () => {
    expect(tokenizeCommandText('re/start')).toEqual([{ kind: 'text', value: 're/start' }]);
  });

  it('does not treat a URL path segment as a command', () => {
    expect(tokenizeCommandText('See https://example.com/start for docs')).toEqual([
      { kind: 'text', value: 'See https://example.com/start for docs' }
    ]);
  });

  it('returns an empty text segment for an empty string', () => {
    expect(tokenizeCommandText('')).toEqual([{ kind: 'text', value: '' }]);
  });

  it('round-trips: concatenating every segment value reconstructs the original text', () => {
    const text = 'Choose /lang_en or /lang_es, or visit https://chatwright.dev/start.';
    const segments = tokenizeCommandText(text);
    expect(segments.map((segment) => segment.value).join('')).toBe(text);
  });
});
