/**
 * Query-param contract for the landing-hero iframe embed of the /player
 * route. Parsing lives in a pure, framework-free function — no Angular, no
 * DOM — so it can be unit tested the same way as the rest of the player
 * (see player/engine/*.spec.ts): a plain function of (input) -> (output).
 *
 *   ?embed=1                      — hide app chrome (the root shell and the
 *                                   player's own nav/right panels), landing
 *                                   on a transcript-first compact layout.
 *   &sample=<file>                — autoload a BUNDLED_SAMPLES entry by its
 *                                   `file` name (see player/samples.ts).
 *   &autoplay=1                   — start playback once the sample has
 *                                   loaded, subject to prefers-reduced-motion
 *                                   (settled state + the transport bar's own
 *                                   Play button is used instead).
 *
 * Every param is opt-in: with none present, this parses to the all-false/null
 * defaults and nothing about the existing full-page behaviour changes.
 */
export interface EmbedParams {
  readonly embed: boolean;
  readonly sample: string | null;
  readonly autoplay: boolean;
}

/** The minimal shape both `URLSearchParams` and Angular's `ParamMap` satisfy. */
export interface ReadableParams {
  get(name: string): string | null;
}

export function parseEmbedParams(params: ReadableParams): EmbedParams {
  return {
    embed: params.get('embed') === '1',
    sample: params.get('sample'),
    autoplay: params.get('autoplay') === '1'
  };
}
