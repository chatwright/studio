import assert from 'node:assert/strict';

import { PresentationTransport, buildTimeline, settledStateAt } from '@chatwright/player-core';

import {
  ENVELOPE_FIELDS,
  admitEnvelope,
  createContext,
  createEnvelope,
  createExecutionOwner,
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

function createCounters() {
  return {
    externalActions: 0,
    submissions: 0,
    validationConsumptions: 0,
    credits: 0,
    staleRejections: 0,
    duplicateRejections: 0,
    revisitReleases: 0
  };
}

/** The caller-side release path: admit first, then release the exact ticket. */
function admitAndRelease(transport, context, envelope, counters) {
  const admitted = admitEnvelope(context, envelope);
  if (!admitted.accepted) {
    counters.staleRejections += 1;
    return false;
  }
  const released = transport.releaseWait(transport.state.wait);
  if (released) {
    counters.validationConsumptions += 1;
    counters.credits += 1;
  } else {
    counters.duplicateRejections += 1;
  }
  return released;
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
      const envelope = createEnvelope(context, { assisted: false });
      assert.equal(admitAndRelease(transport, context, envelope, counters), true);
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
      const valid = createEnvelope(context);
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
        const mutated = createEnvelope(context, { [field]: value });
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
        const envelope = createEnvelope(context, { assisted });
        assert.equal(admitEnvelope(context, envelope).accepted, true, `assisted=${assisted}`);
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
      const contextA = createContext();
      const transport = new PresentationTransport(8, plan());
      waitAtBarrier(transport);
      const envelopeA = createEnvelope(contextA, { assisted: true });
      assert.equal(admitAndRelease(transport, contextA, envelopeA, counters), true);
      owner.record(contextA, envelopeA);

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
      counters.credits += 0;
      assert.equal(counters.credits, 1);

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
    name: 'localised pinned messages resolve before timing and retain grading identity',
    run() {
      const catalogues = [
        { locale: 'en', messages: { 'retry.explanation': 'Repeated requests need an idempotency key.' } },
        { locale: 'fr', messages: { 'retry.explanation': 'Les requêtes répétées ont besoin d’une clé.' } }
      ];
      const context = createContext();
      const english = resolveCatalogue(catalogues, 'en', 'en');
      const french = resolveCatalogue(catalogues, 'en', 'fr-FR');
      assert.notEqual(english('retry.explanation'), french('retry.explanation'));
      assert.equal(context.challengeId, 'retry-query');
      assert.equal(context.challengeRevision, 1);
      assert.equal(context.checkpointId, 'result');
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
