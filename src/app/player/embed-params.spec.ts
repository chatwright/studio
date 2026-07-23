import { describe, expect, it } from 'vitest';

import { parseEmbedParams } from './embed-params';

describe('parseEmbedParams', () => {
  it('defaults to embed off, no sample, no autoplay when nothing is present', () => {
    const result = parseEmbedParams(new URLSearchParams(''));
    expect(result).toEqual({ embed: false, sample: null, autoplay: false });
  });

  it('reads embed=1, sample and autoplay=1 from a URLSearchParams', () => {
    const result = parseEmbedParams(
      new URLSearchParams('embed=1&sample=greetbot-two-part.chatwright.json&autoplay=1')
    );
    expect(result).toEqual({
      embed: true,
      sample: 'greetbot-two-part.chatwright.json',
      autoplay: true
    });
  });

  it('treats any value other than the literal "1" as false, not just "0"', () => {
    const result = parseEmbedParams(new URLSearchParams('embed=true&autoplay=yes'));
    expect(result.embed).toBe(false);
    expect(result.autoplay).toBe(false);
  });

  it('accepts anything with a ParamMap-shaped get(), e.g. Angular\'s ParamMap', () => {
    const fakeParamMap = { get: (name: string) => (name === 'embed' ? '1' : null) };
    expect(parseEmbedParams(fakeParamMap)).toEqual({ embed: true, sample: null, autoplay: false });
  });

  it('leaves sample null when the param is absent', () => {
    const result = parseEmbedParams(new URLSearchParams('embed=1'));
    expect(result.sample).toBeNull();
  });
});
