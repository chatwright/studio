import { Bundle, BundleRun, RUN_BUNDLE_FORMAT_V1 } from './bundle.types';

/**
 * Result of attempting to read a run bundle from raw text or a parsed value.
 * A friendly, human-readable error is always preferred over a thrown
 * exception — the player must degrade gracefully, never crash (brief).
 */
export type ParseResult =
  | { ok: true; bundle: Bundle; warnings: string[] }
  | { ok: false; error: string };

const KNOWN_FORMAT_PREFIX = 'https://chatwright.dev/formats/run-bundle/';

/** Parse and lightly validate a run bundle from raw JSON text. */
export function parseBundleText(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `That file is not valid JSON — ${detail}` };
  }
  return parseBundleValue(value);
}

/**
 * Validate an already-parsed value as a run bundle. Only structural
 * essentials are checked: the format URL and the presence of a runs array.
 * Unknown extra fields are ignored (forward-compatible), and per the schema
 * $comment, a dangling anchor or an unrecognised enum value is never a decode
 * error — it is surfaced downstream, never rejected here.
 */
export function parseBundleValue(value: unknown): ParseResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'That file is not a run bundle — expected a JSON object at the top level.' };
  }

  const record = value as Record<string, unknown>;
  const format = record['format'];

  if (typeof format !== 'string' || format.length === 0) {
    return {
      ok: false,
      error:
        'That file has no "format" field, so it cannot be recognised as a Chatwright run bundle.'
    };
  }

  const warnings: string[] = [];

  if (format !== RUN_BUNDLE_FORMAT_V1) {
    if (format.startsWith(KNOWN_FORMAT_PREFIX)) {
      // A future run-bundle version — read optimistically, warn loudly.
      warnings.push(
        `This bundle declares format "${format}", but this player understands ${RUN_BUNDLE_FORMAT_V1}. Some details may not render.`
      );
    } else {
      return {
        ok: false,
        error: `Unknown format "${format}". This player reads Chatwright run bundles (${RUN_BUNDLE_FORMAT_V1}).`
      };
    }
  }

  const metadata = record['metadata'];
  if (metadata === undefined || metadata === null || typeof metadata !== 'object') {
    warnings.push('This bundle is missing its "metadata" block; provenance will be blank.');
  }

  const rawRuns = record['runs'];
  if (rawRuns !== null && rawRuns !== undefined && !Array.isArray(rawRuns)) {
    return { ok: false, error: 'This bundle\'s "runs" field is not an array.' };
  }

  const runs = (Array.isArray(rawRuns) ? rawRuns : []) as BundleRun[];
  if (runs.length === 0) {
    warnings.push('This bundle contains no runs — there is nothing to play.');
  }

  const bundle: Bundle = {
    format,
    metadata:
      metadata && typeof metadata === 'object'
        ? (metadata as Bundle['metadata'])
        : { createdAt: '' },
    runs
  };

  return { ok: true, bundle, warnings };
}
