import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  PresentationTransport,
  TYPING_MS_PER_CHAR,
  buildTimeline,
  frameDelayMs,
  settledStateAt
} from '@chatwright/player-core';

import {
  ENVELOPE_FIELDS,
  REQUIRED_PARTS,
  admitEnvelope,
  createConsumptionLedger,
  createContext,
  createCreditLedger,
  createEnvelope,
  createExecutionOwner,
  createObservation,
  createObservedEnvelope,
  observationRejection,
  resolveCatalogue,
  storedCompletionEligible
} from './adapter.mjs';

/**
 * Checks that run against a real tarball install outside the repository. They
 * prove the public transport surface and the caller-owned fencing rules; they
 * never import the repository source.
 */

function plan(barrierIndex = 2) {
  return {
    segments: [
      { id: 'brief', startIndex: 0, endIndex: 3 },
      { id: 'discussion', startIndex: 4, endIndex: 7 }
    ],
    barriers: [{ id: 'result', segmentId: 'brief', atIndex: barrierIndex }]
  };
}

/**
 * Raw pinned consumer fixtures. The declared byte length and SHA-256 are part
 * of the pin: a locale claim is verified against the exact bytes before the
 * JSON is parsed, keys are resolved or any timing decision is made.
 */
const PINNED_CATALOGUES = Object.freeze({
  en: Object.freeze({
    bytes:
      '{"schemaVersion":1,"locale":"en","messages":{"retry.explanation":"Repeated requests need an idempotency key."}}',
    byteLength: 111,
    sha256: 'e83f6779ddf7d2da312c67ba2ba9288af96b73e2afe891fefcfb348d3a9ef827'
  }),
  fr: Object.freeze({
    bytes:
      '{"schemaVersion":1,"locale":"fr","messages":{"retry.explanation":"Les requêtes répétées ont besoin d’une clé."}}',
    byteLength: 119,
    sha256: '2d8f5f62b4077487fb918ff7a626dc454845e8cdda9259d70c458b9b07476572'
  })
});

function verifyPinnedCatalogueBytes(pin, candidateBytes = pin.bytes) {
  const byteLength = Buffer.byteLength(candidateBytes, 'utf8');
  if (byteLength !== pin.byteLength) {
    throw new RangeError(
      `pinned catalogue byte length mismatch: expected ${pin.byteLength}, observed ${byteLength}`
    );
  }
  const digest = createHash('sha256').update(candidateBytes, 'utf8').digest('hex');
  if (digest !== pin.sha256) {
    throw new RangeError(
      `pinned catalogue sha256 mismatch: expected ${pin.sha256}, observed ${digest}`
    );
  }
  return candidateBytes;
}

/**
 * A narrow synthetic run whose only variable is the verified catalogue message
 * text. It enters the real public `buildTimeline`/`settledStateAt` APIs, so the
 * settled transcript and the declared typing duration depend on the resolved
 * message rather than on a marker string in the proof.
 */
function localeRun(text) {
  return {
    id: 'locale-resolution-proof',
    platform: 'telegram',
    endpointProfile: 'platform-emulated',
    actors: [
      { id: 'learner', type: 'human', platformIdentities: { telegram: { userId: 7 } } }
    ],
    chats: [
      {
        chatId: 7,
        entries: [
          {
            direction: 'user',
            kind: 'message',
            messageId: 1,
            refMessageId: 0,
            version: 0,
            text,
            actions: null,
            method: '',
            at: '2026-01-01T10:00:00.000Z',
            fromId: 7
          }
        ]
      }
    ],
    parts: [
      {
        id: 'retry',
        title: 'Retry',
        kind: 'deterministic',
        journalBoundary: { chats: [{ chatId: 7, firstEntry: 0, entryCount: 1 }] }
      }
    ]
  };
}

function localePresentation(text) {
  const timeline = buildTimeline(localeRun(text));
  const final = settledStateAt(timeline, timeline.length - 1);
  const message = final.chats[0].items.find((item) => item.kind === 'message').message;
  const step = timeline.find((candidate) => candidate.kind === 'journal');
  return { timeline, final, text: message.text, animation: step.animation };
}

/**
 * The same assertion used for the green path and for the deliberate bypass.
 * Passing raw key text instead of the resolved message must break it.
 */
function assertResolvedPresentation(locale, entryText, expectedText) {
  const observed = localePresentation(entryText);
  assert.equal(observed.final.messageCount, 1, `${locale}: one settled message`);
  assert.equal(observed.text, expectedText, `${locale}: settled text must be the resolved message`);
  assert.equal(observed.animation.primitive, 'compose-and-send', `${locale}: typing primitive`);
  assert.equal(observed.animation.typedText, expectedText, `${locale}: typed text must be resolved`);
  return observed;
}

function createCounters() {
  return {
    externalActions: 0,
    submissions: 0,
    validationConsumptions: 0,
    acceptedResults: 0,
    credits: 0,
    staleRejections: 0,
    duplicateRejections: 0,
    capacityRejections: 0,
    revisitReleases: 0
  };
}

/**
 * The caller-side release path: validate the trusted result and exact current
 * wait, preflight bounded consumption, release once, then commit consumption
 * and the idempotent mapping credit. A stale result or failed release consumes
 * nothing, so the valid fresh result remains available.
 */
function admitAndRelease(transport, context, envelope, observations, counters, ledger, creditLedger) {
  const admitted = admitEnvelope(context, envelope);
  if (!admitted.accepted) {
    counters.staleRejections += 1;
    return false;
  }
  const observed = observationRejection(context, observations);
  if (observed !== null) {
    counters.staleRejections += 1;
    return false;
  }
  const ticket = transport.state.wait;
  if (ticket === null) {
    counters.duplicateRejections += 1;
    return false;
  }
  const consumption = ledger.precheck(context, envelope);
  if (!consumption.ok) {
    if (consumption.reason === 'capacity-exhausted') {
      counters.capacityRejections += 1;
    } else {
      counters.duplicateRejections += 1;
    }
    return false;
  }
  if (!creditLedger.has(context) && creditLedger.size >= creditLedger.capacity) {
    counters.capacityRejections += 1;
    return false;
  }
  if (!transport.releaseWait(ticket)) {
    counters.duplicateRejections += 1;
    return false;
  }
  const committed = ledger.consume(context, envelope);
  if (!committed.consumed) {
    counters.duplicateRejections += 1;
    return false;
  }
  counters.validationConsumptions += 1;
  counters.acceptedResults += 1;
  if (creditLedger.credit(context).credited) {
    counters.credits += 1;
  }
  return true;
}

/** Every required named part observed as passed in this exact context. */
function passingObservations(context) {
  return REQUIRED_PARTS.map((part) => createObservation(context, part));
}

function createPositiveResult(context, overrides = {}) {
  const observations = passingObservations(context);
  return { observations, envelope: createObservedEnvelope(context, observations, overrides) };
}

function waitAtBarrier(transport) {
  while (transport.state.wait === null && transport.state.canAdvance) {
    transport.advance();
  }
  assert.equal(transport.state.status, 'waiting');
}

const samples = {
  run: {
    id: 'transport-proof',
    platform: 'telegram',
    endpointProfile: 'platform-emulated',
    actors: [
      { id: 'learner', type: 'human', platformIdentities: { telegram: { userId: 7 } } },
      { id: 'guide', type: 'bot', platformIdentities: { telegram: { userId: 1 } } }
    ],
    chats: [
      {
        chatId: 7,
        entries: [
          { direction: 'user', kind: 'message', messageId: 1, refMessageId: 0, version: 0, text: 'Open the incident', actions: null, method: '', at: '2026-01-01T10:00:00.000Z', fromId: 7 },
          { direction: 'bot', kind: 'message', messageId: 2, refMessageId: 0, version: 0, text: 'Read the retry evidence', actions: null, method: '', at: '2026-01-01T10:00:01.000Z', fromId: 1 },
          { direction: 'bot', kind: 'message', messageId: 3, refMessageId: 0, version: 0, text: 'Submit the whole challenge', actions: null, method: '', at: '2026-01-01T10:00:02.000Z', fromId: 1 },
          { direction: 'user', kind: 'message', messageId: 4, refMessageId: 0, version: 0, text: 'Running the retry query', actions: null, method: '', at: '2026-01-01T10:00:03.000Z', fromId: 7 },
          { direction: 'bot', kind: 'message', messageId: 5, refMessageId: 0, version: 0, text: 'Twelve duplicate requests', actions: null, method: '', at: '2026-01-01T10:00:04.000Z', fromId: 1 },
          { direction: 'bot', kind: 'message', messageId: 6, refMessageId: 0, version: 0, text: 'Add an idempotency key', actions: null, method: '', at: '2026-01-01T10:00:05.000Z', fromId: 1 },
          { direction: 'user', kind: 'message', messageId: 7, refMessageId: 0, version: 0, text: 'Re-running with the key', actions: null, method: '', at: '2026-01-01T10:00:06.000Z', fromId: 7 },
          { direction: 'bot', kind: 'message', messageId: 8, refMessageId: 0, version: 0, text: 'One request per key', actions: null, method: '', at: '2026-01-01T10:00:07.000Z', fromId: 1 }
        ]
      }
    ],
    parts: [
      {
        id: 'retries',
        title: 'Inspect retries',
        kind: 'deterministic',
        journalBoundary: { chats: [{ chatId: 7, firstEntry: 0, entryCount: 8 }] }
      }
    ]
  }
};

export const TRANSPORT_CHECKS = [
  {
    name: 'public transport surface is exported from the packed root',
    run() {
      assert.equal(typeof PresentationTransport, 'function');
      for (const method of ['seek', 'advance', 'releaseWait', 'enterSegment', 'reset', 'dispose']) {
        assert.equal(typeof PresentationTransport.prototype[method], 'function', method);
      }
      assert.equal(new PresentationTransport(2).state.status, 'idle');
    }
  },
  {
    name: 'play waits at a barrier, does nothing, releases once and resumes inside the segment',
    run() {
      const transport = new PresentationTransport(8, plan());
      const counters = createCounters();
      const context = createContext();

      transport.advance();
      transport.advance();
      const waiting = transport.advance();
      assert.equal(waiting.cursor, 2);
      assert.equal(waiting.status, 'waiting');
      assert.ok(waiting.wait);
      assert.equal(transport.advance().cursor, 2, 'doing nothing keeps waiting');

      const ticket = transport.state.wait;
      const ledger = createConsumptionLedger({ capacity: 2 });
      const creditLedger = createCreditLedger({ capacity: 2 });
      const result = createPositiveResult(context, { assisted: false });
      assert.equal(
        admitAndRelease(
          transport,
          context,
          result.envelope,
          result.observations,
          counters,
          ledger,
          creditLedger
        ),
        true
      );
      assert.equal(counters.acceptedResults, 1);
      assert.equal(counters.credits, 1);
      assert.equal(transport.releaseWait(ticket), false);
      counters.duplicateRejections += 1;
      assert.equal(transport.advance().cursor, 3);
      assert.equal(transport.advance().status, 'segment-end');
      assert.equal(counters.externalActions, 0);
      assert.equal(counters.submissions, 0);
    }
  },
  {
    name: 'a segment end requires an explicit outer Next and never changes chapter implicitly',
    run() {
      const transport = new PresentationTransport(8, plan(0));
      waitAtBarrier(transport);
      transport.releaseWait(transport.state.wait);
      assert.equal(transport.advance().cursor, 1);
      assert.equal(transport.advance().cursor, 2);
      assert.equal(transport.advance().cursor, 3);
      for (let attempt = 0; attempt < 3; attempt++) {
        assert.equal(transport.advance().status, 'segment-end');
      }
      assert.equal(transport.enterSegment('discussion').cursor, 4);
      assert.equal(transport.advance().cursor, 5);
    }
  },
  {
    name: 'watch/seek opens no ticket, grants no credit and preserves settled equivalence',
    run() {
      const transport = new PresentationTransport(8, plan());
      const counters = createCounters();
      const timeline = buildTimeline(samples.run);

      // Sequential playback state is the reference; direct seeks must agree.
      const sequential = new Map();
      for (let index = -1; index < timeline.length; index++) {
        sequential.set(index, JSON.stringify(settledStateAt(timeline, index)));
      }

      const watched = transport.seek(7);
      assert.equal(watched.status, 'preview');
      assert.equal(watched.wait, null);
      assert.equal(transport.state.wait, null);

      for (let index = timeline.length - 1; index >= -1; index--) {
        const state = transport.seek(index);
        assert.equal(state.wait, null, `index ${index} opened no ticket`);
        assert.equal(
          JSON.stringify(settledStateAt(timeline, index)),
          sequential.get(index),
          `settled state at ${index}`
        );
      }
      assert.deepEqual(counters, createCounters());
    }
  },
  {
    name: 'a preview past a barrier is clamped back on Play instead of bypassing validation',
    run() {
      const transport = new PresentationTransport(8, plan());
      assert.equal(transport.seek(3).status, 'preview');
      assert.equal(transport.state.wait, null);
      const playing = transport.advance();
      assert.equal(playing.cursor, 2);
      assert.equal(playing.status, 'waiting');
      assert.ok(playing.wait);
    }
  },
  {
    name: 'every identity, pin, authority, step, checkpoint, attempt and generation mutation rejects',
    run() {
      const context = createContext();
      const valid = createObservedEnvelope(context, passingObservations(context));
      assert.deepEqual(admitEnvelope(context, valid), { accepted: true, reason: null });

      const mutations = {
        project: 'synthetic://other-project',
        authorityGeneration: context.authorityGeneration + 1,
        contentPin: { kind: 'git', commit: '2'.repeat(40) },
        declarationSha256: 'd'.repeat(64),
        narrativeSha256: 'e'.repeat(64),
        trainingPackageSha256: 'f'.repeat(64),
        walkthroughId: 'other-walkthrough',
        chapterId: 'other-chapter',
        stepId: 'other-step',
        challengeId: 'other-challenge',
        challengeRevision: context.challengeRevision + 1,
        checkpointId: 'other-checkpoint',
        attemptId: 'attempt-b',
        submissionGeneration: context.submissionGeneration + 1
      };

      for (const [field, value] of Object.entries(mutations)) {
        const mutated = createEnvelope(context, {
          outcome: 'passed',
          complete: true,
          [field]: value
        });
        const admitted = admitEnvelope(context, mutated);
        assert.equal(admitted.accepted, false, `mutation of ${field} must reject`);
        assert.match(admitted.reason, new RegExp(`mismatch:${field}`));
      }
      assert.equal(ENVELOPE_FIELDS.length, 17);
    }
  },
  {
    name: 'assistance is orthogonal; incomplete and non-passing outcomes reject',
    run() {
      const context = createContext();
      for (const assisted of [false, true]) {
        const result = createPositiveResult(context, { assisted });
        assert.equal(
          admitEnvelope(context, result.envelope).accepted,
          true,
          `assisted=${assisted}`
        );
      }
      for (const outcome of ['failed', 'cancelled', 'timed-out', 'error']) {
        assert.equal(admitEnvelope(context, createEnvelope(context, { outcome })).accepted, false, outcome);
        assert.equal(
          admitEnvelope(context, createEnvelope(context, { outcome, assisted: true })).accepted,
          false,
          `${outcome} assisted`
        );
      }
      assert.equal(admitEnvelope(context, createEnvelope(context, { complete: false })).accepted, false);
      assert.equal(
        admitEnvelope(context, createEnvelope(context, { outcome: 'failed', complete: true })).accepted,
        false
      );
    }
  },
  {
    name: 'completion derives from required named parts in the same context, not a forged summary',
    run() {
      const context = createContext();
      const complete = passingObservations(context);

      // Green: every required part observed as passed, assistance orthogonal.
      const assistedPass = createObservedEnvelope(context, complete, { assisted: true });
      assert.equal(admitEnvelope(context, assistedPass).accepted, true);
      const owner = createExecutionOwner();
      owner.record(context, assistedPass, complete);
      const retained = owner.completionFor(context);
      assert.equal(storedCompletionEligible(context, retained), true);
      assert.deepEqual(retained.parts.map((part) => part.part), [...REQUIRED_PARTS]);

      // Red: a missing part cannot produce or retain completion.
      const missing = complete.filter((observation) => observation.part !== 'query');
      assert.match(observationRejection(context, missing), /missing-part:query/);
      const missingEnvelope = createObservedEnvelope(context, missing);
      assert.equal(missingEnvelope.complete, false);
      assert.equal(missingEnvelope.outcome, 'failed');
      assert.equal(admitEnvelope(context, missingEnvelope).accepted, false);
      assert.throws(() => owner.record(context, missingEnvelope, missing), /missing-part:query/);
      assert.equal(storedCompletionEligible(context, owner.completionFor(context)), true);

      // Red: a failed part cannot produce or retain completion.
      const failed = complete.map((observation) =>
        observation.part === 'conclude'
          ? createObservation(context, 'conclude', { outcome: 'failed' })
          : observation
      );
      assert.match(observationRejection(context, failed), /failed-part:conclude/);
      assert.throws(
        () => owner.record(context, createObservedEnvelope(context, failed), failed),
        /failed-part:conclude/
      );

      // Red: a forged passed+complete envelope with no complete observation set.
      const forged = createEnvelope(context, { outcome: 'passed', complete: true });
      assert.equal(
        admitEnvelope(context, forged).accepted,
        true,
        'envelope-level admission alone cannot detect missing parts'
      );
      assert.throws(() => owner.record(context, forged, []), /missing-part:inspect/);
      assert.throws(() => owner.record(context, forged, missing), /missing-part:query/);
      assert.equal(storedCompletionEligible(context, owner.completionFor(context)), true);

      // Red: observations from another context (same part names) do not count.
      const other = createContext({ attemptId: 'attempt-other' });
      const foreign = [createObservation(other, 'inspect'), ...complete.slice(1)];
      assert.match(observationRejection(context, foreign), /observation-context-mismatch:attemptId/);
    }
  },
  {
    name: 'a recreated wait rejects a structurally cloned identity but accepts a fresh generation as a new result',
    run() {
      const context = createContext();
      const transport = new PresentationTransport(8, plan());
      const counters = createCounters();
      const ledger = createConsumptionLedger({ capacity: 3 });
      const creditLedger = createCreditLedger({ capacity: 2 });
      const result = createPositiveResult(context);

      waitAtBarrier(transport);
      assert.equal(
        admitAndRelease(
          transport,
          context,
          result.envelope,
          result.observations,
          counters,
          ledger,
          creditLedger
        ),
        true
      );
      assert.equal(counters.validationConsumptions, 1);
      assert.equal(counters.acceptedResults, 1);
      assert.equal(counters.credits, 1);
      assert.equal(ledger.size, 1);
      assert.equal(creditLedger.size, 1);

      // Recreate the presentation wait under unchanged scalar context and replay
      // a structural clone. Object identity is not the fence: the caller-owned
      // consumed result identity is, so the ticket stays open.
      transport.reset();
      waitAtBarrier(transport);
      const recreated = transport.state.wait;
      const envelopeClone = JSON.parse(JSON.stringify(result.envelope));
      const observationsClone = JSON.parse(JSON.stringify(result.observations));
      assert.notEqual(envelopeClone, result.envelope, 'the replay really is a structural clone');
      assert.equal(
        admitAndRelease(
          transport,
          context,
          envelopeClone,
          observationsClone,
          counters,
          ledger,
          creditLedger
        ),
        false
      );
      assert.equal(transport.state.wait, recreated, 'the rejected replay leaves the current ticket open');
      assert.equal(counters.validationConsumptions, 1);
      assert.equal(counters.acceptedResults, 1);
      assert.equal(counters.credits, 1);
      assert.equal(counters.duplicateRejections, 1);
      assert.equal(ledger.size, 1, 'bookkeeping is bounded by consumed identities, not tickets');

      // A genuinely new result needs a fresh attempt/submission generation.
      const freshContext = createContext({ attemptId: 'attempt-b', submissionGeneration: 2 });
      const fresh = createPositiveResult(freshContext);
      assert.equal(
        admitAndRelease(
          transport,
          freshContext,
          fresh.envelope,
          fresh.observations,
          counters,
          ledger,
          creditLedger
        ),
        true
      );
      assert.equal(counters.acceptedResults, 2, 'fresh generation is a second accepted result');
      assert.equal(counters.credits, 1, 'the same context/checkpoint mapping stays one credit');
      assert.equal(ledger.size, 2);
      assert.equal(creditLedger.size, 1);
    }
  },
  {
    name: 'a stale or failed release does not consume a valid fresh result',
    run() {
      const context = createContext();
      const transport = new PresentationTransport(8, plan());
      const counters = createCounters();
      const ledger = createConsumptionLedger({ capacity: 2 });
      const creditLedger = createCreditLedger({ capacity: 2 });
      const result = createPositiveResult(context);

      // No current wait: release cannot happen, so nothing may be consumed.
      assert.equal(
        admitAndRelease(
          transport,
          context,
          result.envelope,
          result.observations,
          counters,
          ledger,
          creditLedger
        ),
        false
      );
      assert.equal(ledger.size, 0);
      assert.equal(ledger.has(context), false);
      assert.equal(counters.duplicateRejections, 1);
      assert.equal(counters.acceptedResults, 0);
      assert.equal(counters.credits, 0);

      // A revoked ticket behaves the same: the valid fresh result stays available.
      waitAtBarrier(transport);
      transport.seek(0);
      assert.equal(transport.releaseWait(Object.freeze({ id: 999 })), false);
      assert.equal(ledger.size, 0);

      waitAtBarrier(transport);
      assert.equal(
        admitAndRelease(
          transport,
          context,
          result.envelope,
          result.observations,
          counters,
          ledger,
          creditLedger
        ),
        true
      );
      assert.equal(ledger.size, 1);
      assert.equal(counters.validationConsumptions, 1);
      assert.equal(counters.acceptedResults, 1);
      assert.equal(counters.credits, 1);
    }
  },
  {
    name: 'finite ledger capacity fails closed and keeps the old consumed replay rejected',
    run() {
      const transport = new PresentationTransport(8, plan());
      const counters = createCounters();
      const ledger = createConsumptionLedger({ capacity: 2 });
      const creditLedger = createCreditLedger({ capacity: 2 });

      for (const [attemptId, submissionGeneration] of [
        ['attempt-a', 1],
        ['attempt-b', 2]
      ]) {
        const context = createContext({ attemptId, submissionGeneration });
        const result = createPositiveResult(context);
        waitAtBarrier(transport);
        assert.equal(
          admitAndRelease(
            transport,
            context,
            result.envelope,
            result.observations,
            counters,
            ledger,
            creditLedger
          ),
          true
        );
        transport.reset();
      }
      assert.equal(ledger.size, 2, 'capacity is exactly the declared small fixture inventory');
      assert.equal(creditLedger.size, 1);

      const thirdContext = createContext({ attemptId: 'attempt-c', submissionGeneration: 3 });
      const third = createPositiveResult(thirdContext);
      waitAtBarrier(transport);
      const thirdTicket = transport.state.wait;
      assert.equal(
        admitAndRelease(
          transport,
          thirdContext,
          third.envelope,
          third.observations,
          counters,
          ledger,
          creditLedger
        ),
        false
      );
      assert.equal(transport.state.wait, thirdTicket, 'capacity exhaustion leaves the wait open');
      assert.equal(counters.capacityRejections, 1);
      assert.equal(counters.acceptedResults, 2);
      assert.equal(counters.validationConsumptions, 2);
      assert.equal(counters.credits, 1);
      assert.equal(ledger.size, 2, 'exhaustion never evicts a consumed identity');

      // The original identity is still remembered, not evicted to make room.
      const firstContext = createContext({ attemptId: 'attempt-a', submissionGeneration: 1 });
      const first = createPositiveResult(firstContext);
      assert.equal(
        admitAndRelease(
          transport,
          firstContext,
          first.envelope,
          first.observations,
          counters,
          ledger,
          creditLedger
        ),
        false
      );
      assert.equal(ledger.has(firstContext), true);
      assert.equal(counters.duplicateRejections, 1, 'the old replay is rejected as already consumed');
      assert.equal(counters.acceptedResults, 2);
      assert.equal(transport.state.wait, thirdTicket);
    }
  },
  {
    name: 'unknown fields, payload leakage and reference-only outcomes cannot validate',
    run() {
      const context = createContext();
      for (const forbidden of ['rows', 'sql', 'evidence', 'transcript', 'capturedValues', 'namespace']) {
        assert.equal(
          admitEnvelope(context, createEnvelope(context, { [forbidden]: 'leak' })).accepted,
          false,
          forbidden
        );
      }
      const referenceOnly = createEnvelope(context, { namespace: 'reference', source: 'watch' });
      assert.equal(admitEnvelope(context, referenceOnly).accepted, false);
    }
  },
  {
    name: 'duplicate, previous-instance and other-lifetime tickets cannot resume twice',
    run() {
      const first = new PresentationTransport(8, plan());
      waitAtBarrier(first);
      const ticket = first.state.wait;
      first.seek(0);
      assert.equal(first.releaseWait(ticket), false);

      const second = new PresentationTransport(8, plan());
      waitAtBarrier(second);
      const secondTicket = second.state.wait;
      assert.equal(secondTicket.id, ticket.id, 'both instances start their ticket scalar at 1');
      assert.equal(second.releaseWait(ticket), false);
      assert.equal(second.releaseWait({ ...secondTicket }), false);
      assert.equal(second.releaseWait(secondTicket), true);
      assert.equal(second.releaseWait(secondTicket), false);
    }
  },
  {
    name: 'stored completion from attempt A satisfies a B revisit without a new envelope; A envelopes cannot settle B',
    run() {
      const owner = createExecutionOwner();
      const counters = createCounters();
      const ledger = createConsumptionLedger({ capacity: 2 });
      const creditLedger = createCreditLedger({ capacity: 2 });
      const contextA = createContext();
      const transport = new PresentationTransport(8, plan());
      waitAtBarrier(transport);
      const resultA = createPositiveResult(contextA, { assisted: true });
      assert.equal(
        admitAndRelease(
          transport,
          contextA,
          resultA.envelope,
          resultA.observations,
          counters,
          ledger,
          creditLedger
        ),
        true
      );
      owner.record(contextA, resultA.envelope, resultA.observations);
      const envelopeA = resultA.envelope;

      const contextB = createContext({ attemptId: 'attempt-b', submissionGeneration: 2 });
      transport.reset();
      waitAtBarrier(transport);
      const currentTicket = transport.state.wait;

      // A delayed A envelope is not a B result.
      const delayed = admitEnvelope(contextB, envelopeA);
      assert.equal(delayed.accepted, false);
      assert.match(delayed.reason, /mismatch:attemptId|mismatch:submissionGeneration/);
      assert.equal(transport.state.wait, currentTicket, 'rejected envelope changed nothing');

      // The execution owner's retained A completion is eligible for the revisit.
      const stored = owner.completionFor(contextB);
      assert.ok(stored);
      assert.equal('attemptId' in stored, false, 'the stored completion is not an invented envelope');
      assert.equal('submissionGeneration' in stored, false);
      assert.equal(storedCompletionEligible(contextB, stored), true);
      assert.equal(transport.releaseWait(currentTicket), true);
      counters.revisitReleases += 1;
      assert.equal(counters.acceptedResults, 1, 'the revisit invents no second result');
      assert.equal(counters.credits, 1, 'the revisit grants no second credit');
      assert.equal(ledger.size, 1, 'the revisit consumes no new identity');

      const changedAuthority = createContext({ authorityGeneration: 2 });
      assert.equal(owner.completionFor(changedAuthority), null);
      assert.equal(storedCompletionEligible(changedAuthority, stored), false);
      const changedPin = createContext({ declarationSha256: 'd'.repeat(64) });
      assert.equal(owner.completionFor(changedPin), null);
      const changedRevision = createContext({ challengeRevision: 2 });
      assert.equal(owner.completionFor(changedRevision), null);
    }
  },
  {
    name: 'two independent players do not share tickets, released barriers or progress',
    run() {
      const first = new PresentationTransport(8, plan());
      const second = new PresentationTransport(8, plan());
      waitAtBarrier(first);
      assert.equal(first.state.wait?.barrierId, 'result');
      assert.equal(second.state.status, 'idle');
      assert.equal(second.state.cursor, -1);
      assert.equal(first.releaseWait(second.state.wait), false);

      const ticket = first.state.wait;
      assert.equal(first.releaseWait(ticket), true);
      waitAtBarrier(second);
      assert.equal(second.state.status, 'waiting');
      assert.equal(first.advance().cursor, 3, 'first transport kept its own release');
    }
  },
  {
    name: 'raw catalogue pins verify byte length and SHA-256 before parsing, resolution and timing',
    run() {
      const order = [];
      const catalogues = [];
      for (const locale of ['en', 'fr']) {
        order.push(`verify:${locale}`);
        const bytes = verifyPinnedCatalogueBytes(PINNED_CATALOGUES[locale]);
        order.push(`parse:${locale}`);
        catalogues.push(JSON.parse(bytes));
      }

      order.push('resolve');
      const context = createContext();
      const english = resolveCatalogue(catalogues, 'en', 'en');
      const french = resolveCatalogue(catalogues, 'en', 'fr-FR');
      const fallback = resolveCatalogue(catalogues, 'en', 'de-DE');
      const englishText = english('retry.explanation');
      const frenchText = french('retry.explanation');
      assert.equal(englishText, 'Repeated requests need an idempotency key.');
      assert.equal(frenchText, 'Les requêtes répétées ont besoin d’une clé.');
      assert.equal(fallback('retry.explanation'), englishText, 'stable-key fallback');
      assert.notEqual(englishText, frenchText);

      // Resolved text enters the real public timeline, settled-state and
      // animation APIs: the transcript and typing duration follow the message.
      order.push('buildTimeline+settled+animation');
      const englishPresentation = assertResolvedPresentation('en', englishText, englishText);
      const frenchPresentation = assertResolvedPresentation('fr-FR', frenchText, frenchText);
      assert.notEqual(englishText.length, frenchText.length, 'fixture message lengths differ');
      assert.ok(
        frenchPresentation.animation.baseDurationMs > englishPresentation.animation.baseDurationMs,
        'the longer French message types for longer'
      );
      assert.equal(
        frenchPresentation.animation.baseDurationMs - englishPresentation.animation.baseDurationMs,
        (frenchText.length - englishText.length) * TYPING_MS_PER_CHAR,
        'typed duration changes exactly by the resolved character-length delta'
      );
      // The virtual-clock pacing function is unchanged, still finite and positive.
      assert.ok(frameDelayMs(800, 1) > 0);
      assert.deepEqual(order, [
        'verify:en',
        'parse:en',
        'verify:fr',
        'parse:fr',
        'resolve',
        'buildTimeline+settled+animation'
      ]);

      // Bypassing resolution leaves key text in the transcript and a shorter
      // typing duration, which breaks the same presentation assertion.
      assert.throws(
        () => assertResolvedPresentation('en', 'retry.explanation', englishText),
        /settled text must be the resolved message/
      );
      const bypassed = localePresentation('retry.explanation');
      assert.equal(bypassed.text, 'retry.explanation');
      assert.notEqual(bypassed.animation.baseDurationMs, englishPresentation.animation.baseDurationMs);
      assert.throws(
        () => assert.equal(bypassed.animation.baseDurationMs, englishPresentation.animation.baseDurationMs),
        /strictly equal/
      );

      // Same length, changed byte: the raw digest, not the parsed value, rejects.
      const changedByte = PINNED_CATALOGUES.en.bytes.replace('Repeated', 'Repeatex');
      assert.equal(Buffer.byteLength(changedByte, 'utf8'), PINNED_CATALOGUES.en.byteLength);
      assert.throws(
        () => verifyPinnedCatalogueBytes(PINNED_CATALOGUES.en, changedByte),
        /sha256/
      );

      // Equivalent parsed JSON with altered raw bytes still fails the raw pin.
      const reformatted = JSON.stringify(JSON.parse(PINNED_CATALOGUES.en.bytes), null, 2);
      assert.deepEqual(JSON.parse(reformatted), JSON.parse(PINNED_CATALOGUES.en.bytes));
      assert.throws(
        () => verifyPinnedCatalogueBytes(PINNED_CATALOGUES.en, reformatted),
        /byte length/
      );

      // Wrong length is rejected before any parse or resolution.
      assert.throws(
        () => verifyPinnedCatalogueBytes(PINNED_CATALOGUES.fr, `${PINNED_CATALOGUES.fr.bytes} `),
        /byte length/
      );
      assert.throws(
        () => verifyPinnedCatalogueBytes(PINNED_CATALOGUES.fr, PINNED_CATALOGUES.fr.bytes.slice(0, -1)),
        /byte length/
      );

      // Identity, event order and grading fields are untouched by locale.
      assert.equal(context.challengeId, 'retry-query');
      assert.equal(context.challengeRevision, 1);
      assert.equal(context.checkpointId, 'result');
      assert.equal(context.stepId, 'solve');
      assert.deepEqual(
        englishPresentation.timeline.map((step) => [step.index, step.partId, step.kind, step.at]),
        frenchPresentation.timeline.map((step) => [step.index, step.partId, step.kind, step.at])
      );
      const envelope = createObservedEnvelope(context, passingObservations(context));
      for (const field of [
        'walkthroughId',
        'chapterId',
        'stepId',
        'challengeId',
        'challengeRevision',
        'checkpointId'
      ]) {
        assert.equal(envelope[field], context[field], `grading identity field ${field} unchanged`);
      }
      assert.throws(() => english('missing.key'), /missing pinned message key/);
    }
  },
  {
    name: 'invalid indices and plans fail safely without corrupting a live transport',
    run() {
      const transport = new PresentationTransport(8, plan());
      transport.advance();
      for (const invalid of [NaN, Infinity, -Infinity, 1.25, '3']) {
        assert.equal(transport.seek(invalid).cursor, 0, String(invalid));
      }
      assert.throws(() => transport.enterSegment('missing'), RangeError);
      assert.equal(transport.state.cursor, 0);
      assert.throws(
        () => new PresentationTransport(8, { segments: [{ id: 'gap', startIndex: 1, endIndex: 7 }], barriers: [] }),
        RangeError
      );
      assert.throws(() => new PresentationTransport(-1), RangeError);
    }
  }
];

/**
 * A tiny guard so the suite cannot accidentally pass with no checks.
 * (The proof runner also counts outcomes.)
 */
export function transportCheckCount() {
  return TRANSPORT_CHECKS.length;
}
