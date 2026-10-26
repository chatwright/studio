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

/**
 * The caller declares which named parts a whole-challenge result must observe.
 * A positive result is derived from observations for every one of these parts
 * in the same context; an envelope summary alone is never evidence.
 */
export const REQUIRED_PARTS = Object.freeze(['inspect', 'query', 'conclude']);

/** Identity fields an observation must share with the context it belongs to. */
const CONTEXT_FIELDS = Object.freeze(
  ENVELOPE_FIELDS.filter((field) => field !== 'outcome' && field !== 'complete' && field !== 'assisted')
);

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

/**
 * Build an envelope body. The summary defaults to a non-passing baseline: a
 * caller cannot obtain a positive result merely by constructing an envelope.
 * Positive callers use `createObservedEnvelope`, which derives the summary from
 * required-part observations. The raw constructor remains available so proofs
 * can deliberately forge a passed+complete summary and show it is insufficient.
 */
export function createEnvelope(context, overrides = {}) {
  const envelope = {};
  for (const field of ENVELOPE_FIELDS) {
    envelope[field] = context[field];
  }
  Object.assign(envelope, {
    outcome: 'failed',
    complete: false,
    assisted: false,
    ...overrides
  });
  return deepFreeze(envelope);
}

/** One same-context observation for a declared required named part. */
export function createObservation(context, part, overrides = {}) {
  if (!REQUIRED_PARTS.includes(part)) {
    throw new Error(`unknown required part: ${String(part)}`);
  }
  const observation = {};
  for (const field of CONTEXT_FIELDS) {
    observation[field] = context[field];
  }
  Object.assign(observation, { part, outcome: 'passed', ...overrides });
  if (!OUTCOMES.has(observation.outcome)) {
    throw new Error(`unknown part outcome: ${String(observation.outcome)}`);
  }
  return deepFreeze(observation);
}

/**
 * Validate the whole-attempt observation set: every required part present
 * exactly once, every observation bound to this exact context, and every part
 * passed. Returns a reason string or `null` for a complete positive result.
 */
export function observationRejection(context, observations) {
  if (!Array.isArray(observations)) {
    return 'observations-not-an-array';
  }
  const byPart = new Map();
  for (const candidate of observations) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return 'invalid-observation';
    }
    if (!REQUIRED_PARTS.includes(candidate.part)) {
      return `unknown-part:${String(candidate.part)}`;
    }
    if (!OUTCOMES.has(candidate.outcome)) {
      return `unknown-part-outcome:${String(candidate.outcome)}`;
    }
    for (const field of CONTEXT_FIELDS) {
      if (!sameValue(candidate[field], context[field])) {
        return `observation-context-mismatch:${field}`;
      }
    }
    if (byPart.has(candidate.part)) {
      return `duplicate-part:${candidate.part}`;
    }
    byPart.set(candidate.part, candidate);
  }
  for (const part of REQUIRED_PARTS) {
    const observation = byPart.get(part);
    if (!observation) {
      return `missing-part:${part}`;
    }
    if (observation.outcome !== 'passed') {
      return `failed-part:${part}:${observation.outcome}`;
    }
  }
  return null;
}

/**
 * The only positive-envelope constructor: outcome and completion are derived
 * from the required-part observations, never supplied by the caller.
 */
export function createObservedEnvelope(context, observations, overrides = {}) {
  const complete = observationRejection(context, observations) === null;
  return createEnvelope(context, {
    ...overrides,
    outcome: complete ? 'passed' : 'failed',
    complete
  });
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
    /**
     * Retain a completion only when the whole-attempt observations independently
     * prove every required part passed in this context. A forged envelope that
     * claims `passed`+`complete` cannot substitute for missing or failed parts.
     */
    record(context, envelope, observations) {
      const observed = observationRejection(context, observations);
      if (observed !== null) {
        throw new Error(`execution owner rejected completion: ${observed}`);
      }
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
          assisted: envelope.assisted,
          requiredParts: deepFreeze([...REQUIRED_PARTS]),
          parts: deepFreeze(
            REQUIRED_PARTS.map((part) => ({
              part,
              outcome: observations.find((candidate) => candidate.part === part).outcome
            }))
          )
        })
      );
    },
    completionFor(context) {
      return records.get(key(context)) ?? null;
    }
  };
}

/** Identity fields for a progress credit: pins/checkpoint, never attempt lifetime. */
const MAPPING_FIELDS = Object.freeze(
  CONTEXT_FIELDS.filter((field) => field !== 'attemptId' && field !== 'submissionGeneration')
);

function identityKey(fields, context) {
  return JSON.stringify(fields.map((field) => context[field]));
}

function boundedCapacity(capacity, label) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new TypeError(`${label} capacity must be a positive integer`);
  }
  return capacity;
}

/**
 * Caller-owned once-only consumption across presentation waits. The key is the
 * full immutable result identity (including attempt and submission
 * generation), not a ticket or an object reference: recreating a presentation
 * wait with unchanged identity cannot consume or credit the same result twice,
 * while a genuinely new attempt/generation can.
 *
 * Capacity is finite and never evicts. Exhaustion fails closed with
 * `capacity-exhausted`, so old consumed identities remain rejected rather than
 * being forgotten to make room for a new result. Bookkeeping is bounded by the
 * declared caller inventory, keeps no ticket history and is never package
 * state.
 */
export function createConsumptionLedger({ capacity = 8 } = {}) {
  const limit = boundedCapacity(capacity, 'consumption ledger');
  const consumed = new Set();
  const key = (context) => identityKey(CONTEXT_FIELDS, context);

  function precheck(context, envelope) {
    const rejection = envelopeRejection(context, envelope);
    if (rejection !== null) {
      return { ok: false, reason: rejection };
    }
    if (consumed.has(key(context))) {
      return { ok: false, reason: 'already-consumed' };
    }
    if (consumed.size >= limit) {
      return { ok: false, reason: 'capacity-exhausted' };
    }
    return { ok: true, reason: null };
  }

  return Object.freeze({
    /**
     * Non-mutating admission check. A caller that must release a presentation
     * ticket first runs this before release, so a failed release leaves the
     * valid result unconsumed and still available.
     */
    precheck,
    consume(context, envelope) {
      const pre = precheck(context, envelope);
      if (!pre.ok) {
        return { consumed: false, reason: pre.reason };
      }
      consumed.add(key(context));
      return { consumed: true, reason: null };
    },
    has(context) {
      return consumed.has(key(context));
    },
    get size() {
      return consumed.size;
    },
    get capacity() {
      return limit;
    }
  });
}

/**
 * Caller-owned progress credit, idempotent per immutable context/checkpoint
 * mapping. A fresh attempt/submission generation can be accepted as a new
 * result (`acceptedResults`), but it does not create a second credit for the
 * same pins, challenge revision and checkpoint. Capacity is finite, never
 * evicts and fails closed.
 */
export function createCreditLedger({ capacity = 8 } = {}) {
  const limit = boundedCapacity(capacity, 'credit ledger');
  const credited = new Set();
  const key = (context) => identityKey(MAPPING_FIELDS, context);

  return Object.freeze({
    credit(context) {
      const identity = key(context);
      if (credited.has(identity)) {
        return { credited: false, duplicate: true, reason: 'already-credited-mapping' };
      }
      if (credited.size >= limit) {
        return { credited: false, duplicate: false, reason: 'capacity-exhausted' };
      }
      credited.add(identity);
      return { credited: true, duplicate: false, reason: null };
    },
    has(context) {
      return credited.has(key(context));
    },
    get size() {
      return credited.size;
    },
    get capacity() {
      return limit;
    }
  });
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
    typeof record.assisted === 'boolean' &&
    Array.isArray(record.parts) &&
    REQUIRED_PARTS.every((part) =>
      record.parts.some((observed) => observed.part === part && observed.outcome === 'passed')
    )
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
