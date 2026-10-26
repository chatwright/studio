/**
 * Caller-owned synthetic checkpoint fencing — proof-only.
 *
 * This module is deliberately outside Chatwright's public playback API. It
 * models what a real consumer (for example DataTug) must do on its side:
 * construct the full immutable context, validate a matching whole-challenge
 * result, and only then release the current opaque presentation ticket.
 *
 * It is not a production adapter. It performs no SQL, reads no evidence and
 * claims no server-verified grading. Outcome and assistance are orthogonal.
 */

export const ENVELOPE_FIELDS = Object.freeze([
  'project',
  'authorityGeneration',
  'contentPin',
  'declarationSha256',
  'narrativeSha256',
  'trainingPackageSha256',
  'walkthroughId',
  'chapterId',
  'stepId',
  'challengeId',
  'challengeRevision',
  'checkpointId',
  'attemptId',
  'submissionGeneration',
  'outcome',
  'complete',
  'assisted'
]);

const OUTCOMES = new Set(['passed', 'failed', 'cancelled', 'timed-out', 'error']);
const HASH = /^[0-9a-f]{64}$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function sameValue(left, right) {
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

/** The proof's immutable synthetic context, one per attempt/authority lifetime. */
export function createContext(overrides = {}) {
  return deepFreeze({
    project: 'synthetic://incident-replay/order-11045',
    authorityGeneration: 1,
    contentPin: { kind: 'git', commit: '1'.repeat(40) },
    declarationSha256: 'a'.repeat(64),
    narrativeSha256: 'b'.repeat(64),
    trainingPackageSha256: 'c'.repeat(64),
    walkthroughId: 'training-demo',
    chapterId: 'retries',
    stepId: 'solve',
    challengeId: 'retry-query',
    challengeRevision: 1,
    checkpointId: 'result',
    attemptId: 'attempt-a',
    submissionGeneration: 1,
    ...overrides
  });
}

export function createEnvelope(context, overrides = {}) {
  const envelope = {};
  for (const field of ENVELOPE_FIELDS) {
    envelope[field] = context[field];
  }
  Object.assign(envelope, {
    outcome: 'passed',
    complete: true,
    assisted: false,
    ...overrides
  });
  return deepFreeze(envelope);
}

/**
 * Contract checks that do not depend on the active presentation:
 * exact field set, exact identity match and a consistent whole-attempt summary.
 * Reference-only playback carries a namespace marker, so it is rejected here
 * as an unknown field before it can ever look like a validation result.
 */
export function envelopeRejection(context, envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return 'not-an-envelope';
  }
  const keys = Object.keys(envelope);
  if (keys.length !== ENVELOPE_FIELDS.length || keys.some((key) => !ENVELOPE_FIELDS.includes(key))) {
    return 'unknown-or-missing-fields';
  }
  for (const field of ENVELOPE_FIELDS) {
    if (field === 'outcome' || field === 'complete' || field === 'assisted') {
      continue;
    }
    if (!sameValue(envelope[field], context[field])) {
      return `mismatch:${field}`;
    }
  }
  if (!OUTCOMES.has(envelope.outcome)) {
    return 'unknown-outcome';
  }
  if (typeof envelope.complete !== 'boolean') {
    return 'complete-not-boolean';
  }
  if (typeof envelope.assisted !== 'boolean') {
    return 'assisted-not-boolean';
  }
  if (envelope.outcome !== 'passed') {
    return `not-passed:${envelope.outcome}`;
  }
  if (envelope.complete !== true) {
    return 'incomplete';
  }
  return null;
}

/** Admit or reject one envelope. Only `accepted: true` may release a ticket. */
export function admitEnvelope(context, envelope) {
  const rejection = envelopeRejection(context, envelope);
  return rejection === null
    ? { accepted: true, reason: null }
    : { accepted: false, reason: rejection };
}

/**
 * A separate synthetic execution owner. It retains whole-challenge
 * completions by pins/checkpoint and current authority — never by attempt or
 * submission generation — so an execution-owned prior completion can satisfy
 * a revisit without inventing a new result. Callers never synthesise this
 * record into a fresh envelope.
 */
export function createExecutionOwner() {
  const records = new Map();
  const key = (context) =>
    JSON.stringify([
      context.project,
      context.authorityGeneration,
      context.contentPin,
      context.declarationSha256,
      context.narrativeSha256,
      context.trainingPackageSha256,
      context.walkthroughId,
      context.chapterId,
      context.stepId,
      context.challengeId,
      context.challengeRevision,
      context.checkpointId
    ]);

  return {
    record(context, envelope) {
      const admitted = admitEnvelope(context, envelope);
      if (!admitted.accepted) {
        throw new Error(`execution owner rejected completion: ${admitted.reason}`);
      }
      records.set(
        key(context),
        deepFreeze({
          project: context.project,
          authorityGeneration: context.authorityGeneration,
          contentPin: context.contentPin,
          declarationSha256: context.declarationSha256,
          narrativeSha256: context.narrativeSha256,
          trainingPackageSha256: context.trainingPackageSha256,
          walkthroughId: context.walkthroughId,
          chapterId: context.chapterId,
          stepId: context.stepId,
          challengeId: context.challengeId,
          challengeRevision: context.challengeRevision,
          checkpointId: context.checkpointId,
          outcome: envelope.outcome,
          complete: envelope.complete,
          assisted: envelope.assisted
        })
      );
    },
    completionFor(context) {
      return records.get(key(context)) ?? null;
    }
  };
}

/**
 * Eligibility for a stored-completion revisit: identical pins, checkpoint,
 * chapter/step/target and current live authority. Attempt and submission
 * generation are intentionally not compared here.
 */
export function storedCompletionEligible(context, record) {
  if (!record) {
    return false;
  }
  return (
    record.project === context.project &&
    record.authorityGeneration === context.authorityGeneration &&
    sameValue(record.contentPin, context.contentPin) &&
    record.declarationSha256 === context.declarationSha256 &&
    record.narrativeSha256 === context.narrativeSha256 &&
    record.trainingPackageSha256 === context.trainingPackageSha256 &&
    record.walkthroughId === context.walkthroughId &&
    record.chapterId === context.chapterId &&
    record.stepId === context.stepId &&
    record.challengeId === context.challengeId &&
    record.challengeRevision === context.challengeRevision &&
    record.checkpointId === context.checkpointId &&
    record.outcome === 'passed' &&
    record.complete === true &&
    typeof record.assisted === 'boolean'
  );
}

/**
 * Pinned message catalogues resolve plain text by stable key before timing.
 * Locale changes may change text but never event, chapter, step, challenge,
 * checkpoint or grading identity.
 */
export function resolveCatalogue(catalogues, fallbackLocale, requestedLocale) {
  const canonical = (tag) => String(tag).replace(/_/g, '-').toLowerCase();
  const byLocale = new Map(catalogues.map((catalogue) => [canonical(catalogue.locale), catalogue]));
  const requested = canonical(requestedLocale);
  const primary = requested.split('-')[0];
  const fallback = byLocale.get(canonical(fallbackLocale));
  if (!fallback) {
    throw new Error(`no pinned fallback catalogue for ${fallbackLocale}`);
  }
  const selected = byLocale.get(requested) ?? byLocale.get(primary) ?? fallback;
  return (key) => {
    const text = selected.messages[key] ?? fallback.messages[key];
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error(`missing pinned message key: ${key}`);
    }
    return text;
  };
}
