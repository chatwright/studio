import { describe, expect, it } from 'vitest';

import { isPlaygroundTab, resolveInitialTab } from './default-tab';

describe('isPlaygroundTab', () => {
  it('accepts the four known tabs', () => {
    expect(isPlaygroundTab('telegram')).toBe(true);
    expect(isPlaygroundTab('whatsapp')).toBe(true);
    expect(isPlaygroundTab('compare')).toBe(true);
    expect(isPlaygroundTab('ai-test')).toBe(true);
  });

  it('rejects anything else, including null/undefined/empty', () => {
    expect(isPlaygroundTab('bogus')).toBe(false);
    expect(isPlaygroundTab(null)).toBe(false);
    expect(isPlaygroundTab(undefined)).toBe(false);
    expect(isPlaygroundTab('')).toBe(false);
  });
});

describe('resolveInitialTab', () => {
  it('a valid ?tab= param wins on a wide viewport', () => {
    expect(resolveInitialTab('telegram', true)).toBe('telegram');
    expect(resolveInitialTab('whatsapp', true)).toBe('whatsapp');
  });

  it('a valid ?tab= param wins on a narrow viewport', () => {
    expect(resolveInitialTab('compare', false)).toBe('compare');
  });

  it('defaults to compare on a wide viewport with no param', () => {
    expect(resolveInitialTab(null, true)).toBe('compare');
    expect(resolveInitialTab(undefined, true)).toBe('compare');
  });

  it('defaults to telegram on a narrow viewport with no param', () => {
    expect(resolveInitialTab(null, false)).toBe('telegram');
  });

  it('an invalid ?tab= param is ignored, falling back to the viewport default', () => {
    expect(resolveInitialTab('bogus', true)).toBe('compare');
    expect(resolveInitialTab('bogus', false)).toBe('telegram');
  });

  it('?tab=ai-test is honoured explicitly but is never a viewport default', () => {
    expect(resolveInitialTab('ai-test', true)).toBe('ai-test');
    expect(resolveInitialTab('ai-test', false)).toBe('ai-test');
    expect(resolveInitialTab(null, true)).not.toBe('ai-test');
    expect(resolveInitialTab(null, false)).not.toBe('ai-test');
  });
});
