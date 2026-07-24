import { describe, expect, it } from 'vitest';

import { resolveInitialShowBotInternals } from './internals-default';

describe('resolveInitialShowBotInternals', () => {
  it('single-tab: opens by default on a wide (>=1280px) viewport', () => {
    expect(resolveInitialShowBotInternals('single-tab', true)).toBe(true);
  });

  it('single-tab: stays closed by default on a narrow viewport', () => {
    expect(resolveInitialShowBotInternals('single-tab', false)).toBe(false);
  });

  it('compare: always closed by default on a wide viewport', () => {
    expect(resolveInitialShowBotInternals('compare', true)).toBe(false);
  });

  it('compare: always closed by default on a narrow viewport', () => {
    expect(resolveInitialShowBotInternals('compare', false)).toBe(false);
  });
});
