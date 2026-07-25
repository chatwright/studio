import { ActorLoopEvent, Bundle, BundleRun, RUN_BUNDLE_FORMAT_V1 } from './bundle.types';

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

  const rawRunsArray = Array.isArray(rawRuns) ? rawRuns : [];

  // The wire is now uniformly camelCase. A bundle written before that change
  // carries PascalCase journal fields (Direction/Kind/MessageID/…) and would
  // otherwise decode to a run of empty-looking entries. Detect that signature
  // and refuse it with an actionable message rather than rendering emptily.
  if (looksLikeLegacyPascalCase(rawRunsArray)) {
    return {
      ok: false,
      error:
        'This bundle predates the current format — its journal fields use the old PascalCase names (e.g. "Direction"/"MessageID"). Regenerate it with a current Chatwright build.'
    };
  }

  const runs = rawRunsArray as BundleRun[];
  if (runs.length === 0) {
    warnings.push('This bundle contains no runs — there is nothing to play.');
  }
  backfillFreshness(runs);

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

/**
 * Normalises every loop event's validation outcome in place so
 * {@link ActorValidationOutcome.freshness} is always readable, regardless of
 * which wire name the bundle was written with. A bundle predating the
 * verdict → freshness rename carries the click-validation outcome under
 * `verdict`; a current bundle carries it under `freshness`. Both are read
 * here — `freshness` wins when a (hypothetical, never produced today) bundle
 * somehow carries both — so every other part of the player only ever reads
 * `freshness`.
 */
function backfillFreshness(runs: BundleRun[]): void {
  for (const run of runs) {
    for (const part of run.parts ?? []) {
      for (const event of part.aiGoal?.events ?? []) {
        const validation: ActorLoopEvent['validation'] | undefined = event.validation;
        if (validation && validation.freshness === undefined && validation.verdict !== undefined) {
          validation.freshness = validation.verdict;
        }
      }
    }
  }
}

/**
 * True when the runs carry at least one journal entry and the first such entry
 * has the legacy PascalCase keys while lacking the current camelCase ones —
 * the unambiguous signature of a pre-normalisation bundle.
 */
function looksLikeLegacyPascalCase(runs: unknown[]): boolean {
  for (const run of runs) {
    const chats = (run as { chats?: unknown } | null)?.chats;
    if (!Array.isArray(chats)) {
      continue;
    }
    for (const chat of chats) {
      const entries = (chat as { entries?: unknown } | null)?.entries;
      if (!Array.isArray(entries)) {
        continue;
      }
      for (const entry of entries) {
        if (entry === null || typeof entry !== 'object') {
          continue;
        }
        const record = entry as Record<string, unknown>;
        const hasCamel = 'direction' in record || 'kind' in record || 'messageId' in record;
        const hasPascal = 'Direction' in record || 'Kind' in record || 'MessageID' in record;
        // First real journal entry decides it.
        return hasPascal && !hasCamel;
      }
    }
  }
  return false;
}
