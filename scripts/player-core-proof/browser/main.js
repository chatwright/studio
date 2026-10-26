import { PresentationTransport, buildTimeline, settledStateAt } from '@chatwright/player-core';

import {
  REQUIRED_PARTS,
  admitEnvelope,
  createContext,
  createExecutionOwner,
  createObservation,
  createObservedEnvelope,
  observationRejection,
  storedCompletionEligible
} from './adapter.mjs';

/**
 * Synthetic presentation proof. The transcript and transport both come from the
 * packed package installed in this consumer's node_modules; the adapter is
 * caller-owned and never part of Chatwright's public API.
 */

const run = {
  id: 'browser-transport-proof',
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
};

const timeline = buildTimeline(run);
const plan = {
  segments: [
    { id: 'brief', startIndex: 0, endIndex: 3 },
    { id: 'discussion', startIndex: 4, endIndex: 7 }
  ],
  barriers: [{ id: 'result', segmentId: 'brief', atIndex: 2 }]
};

const transport = new PresentationTransport(timeline.length, plan);
const owner = createExecutionOwner();

let context = createContext();
let playing = false;
let timer = null;
let completedEnvelopeA = null;
let completedObservationsA = null;
let lastReleasedTicket = null;

function passingObservations(target = context) {
  return REQUIRED_PARTS.map((part) => createObservation(target, part));
}
let logLine = 'no external action performed';

const counters = {
  externalActions: 0,
  submissions: 0,
  validationConsumptions: 0,
  credits: 0,
  staleRejections: 0,
  duplicateRejections: 0,
  revisitReleases: 0
};

const statusLabels = {
  idle: 'ready',
  running: 'playing',
  preview: 'preview (watch — no credit)',
  waiting: 'waiting for caller validation',
  'segment-end': 'segment end — explicit Next required',
  ended: 'ended',
  disposed: 'disposed'
};

const elements = {
  status: document.querySelector('#status'),
  cursor: document.querySelector('#cursor'),
  segment: document.querySelector('#segment'),
  ticket: document.querySelector('#ticket'),
  transcript: document.querySelector('#transcript'),
  counters: document.querySelector('#counters'),
  log: document.querySelector('#log'),
  resolved: document.querySelector('#resolved')
};

function visibleMessages() {
  const settled = settledStateAt(timeline, transport.state.cursor);
  const chat = settled.chats[0];
  if (!chat) {
    return [];
  }
  return chat.items
    .filter((item) => item.kind === 'message' && !item.message.deleted)
    .map((item) => ({
      messageId: item.message.messageId,
      direction: item.message.direction,
      text: item.message.text
    }));
}

function render() {
  const state = transport.state;
  const messages = visibleMessages();

  elements.status.textContent = statusLabels[state.status] ?? state.status;
  elements.status.dataset.status = state.status;
  elements.cursor.textContent = String(state.cursor);
  elements.segment.textContent = state.segmentId ?? '—';
  elements.ticket.textContent = state.wait ? `#${state.wait.id} ${state.wait.barrierId}` : '—';

  elements.transcript.replaceChildren(
    ...messages.map((message) => {
      const item = document.createElement('li');
      item.dataset.from = message.direction;
      item.dataset.messageId = String(message.messageId);
      item.textContent = `${message.messageId}. ${message.text}`;
      return item;
    })
  );
  elements.transcript.dataset.count = String(messages.length);

  elements.counters.replaceChildren(
    ...Object.entries(counters).map(([name, value]) => {
      const wrapper = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = name;
      const definition = document.createElement('dd');
      definition.dataset.counter = name;
      definition.textContent = String(value);
      wrapper.append(term, definition);
      return wrapper;
    })
  );
  elements.log.textContent = logLine;
}

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (!playing) {
    return;
  }
  const state = transport.state;
  if (state.status === 'waiting') {
    render();
    return;
  }
  if (state.status === 'segment-end' || state.status === 'ended' || state.status === 'disposed') {
    playing = false;
    render();
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    if (!playing) {
      return;
    }
    transport.advance();
    render();
    schedule();
  }, 200);
}

function play() {
  const state = transport.state;
  if (state.status === 'segment-end' || state.status === 'ended' || state.status === 'disposed') {
    return;
  }
  playing = true;
  if (state.status !== 'waiting') {
    schedule();
  }
  render();
}

function pause() {
  playing = false;
  clearTimeout(timer);
  timer = null;
  render();
}

function startAttempt(overrides) {
  pause();
  context = createContext(overrides);
  transport.reset();
  logLine = `attempt ${context.attemptId}/${context.submissionGeneration} started`;
  render();
  play();
}

function releaseFreshEnvelope(observations, label, overrides = {}) {
  if (transport.state.wait === null) {
    counters.duplicateRejections += 1;
    logLine = `${label}: no current ticket`;
    render();
    return false;
  }
  const observed = observationRejection(context, observations);
  if (observed !== null) {
    counters.staleRejections += 1;
    logLine = `${label}: incomplete required parts (${observed})`;
    render();
    return false;
  }
  const envelope = createObservedEnvelope(context, observations, overrides);
  const admitted = admitEnvelope(context, envelope);
  if (!admitted.accepted) {
    counters.staleRejections += 1;
    logLine = `${label}: rejected (${admitted.reason})`;
    render();
    return false;
  }
  const ticket = transport.state.wait;
  if (!transport.releaseWait(ticket)) {
    counters.duplicateRejections += 1;
    logLine = `${label}: ticket already consumed`;
    render();
    return false;
  }
  counters.validationConsumptions += 1;
  counters.credits += 1;
  lastReleasedTicket = ticket;
  if (context.attemptId === 'attempt-a') {
    completedEnvelopeA = envelope;
    completedObservationsA = observations;
    owner.record(context, envelope, observations);
  }
  logLine = `${label}: accepted once, playback resumes inside the segment`;
  if (playing) {
    schedule();
  }
  render();
  return true;
}

function releaseAssistedPass() {
  releaseFreshEnvelope(passingObservations(), 'assisted pass', { assisted: true });
}

function releaseStale() {
  if (completedEnvelopeA === null) {
    const staleContext = createContext({ attemptId: 'attempt-stale' });
    completedObservationsA = passingObservations(staleContext);
    completedEnvelopeA = createObservedEnvelope(staleContext, completedObservationsA);
  }
  const stale = completedEnvelopeA;
  if (transport.state.wait === null) {
    counters.duplicateRejections += 1;
    logLine = 'stale result: no current ticket';
    render();
    return;
  }
  const admitted = admitEnvelope(context, stale);
  if (admitted.accepted) {
    releaseFreshEnvelope(completedObservationsA, 'attempt-A result');
    return;
  }
  counters.staleRejections += 1;
  logLine = `stale attempt-A result rejected (${admitted.reason}); still waiting`;
  render();
}

function releaseStoredCompletion() {
  if (transport.state.wait === null) {
    counters.duplicateRejections += 1;
    logLine = 'stored completion: no current ticket';
    render();
    return;
  }
  const stored = owner.completionFor(context);
  if (!storedCompletionEligible(context, stored)) {
    counters.staleRejections += 1;
    logLine = 'stored completion: not eligible under current pins/authority';
    render();
    return;
  }
  const ticket = transport.state.wait;
  if (!transport.releaseWait(ticket)) {
    counters.duplicateRejections += 1;
    logLine = 'stored completion: ticket already consumed';
    render();
    return;
  }
  lastReleasedTicket = ticket;
  counters.revisitReleases += 1;
  logLine = 'stored completion A released the current B presentation ticket; no new result or effect';
  if (playing) {
    schedule();
  }
  render();
}

function releaseDuplicate() {
  if (lastReleasedTicket === null) {
    counters.duplicateRejections += 1;
    logLine = 'duplicate: nothing released yet';
    render();
    return;
  }
  if (transport.releaseWait(lastReleasedTicket)) {
    counters.credits += 1;
    logLine = 'duplicate unexpectedly accepted';
  } else {
    counters.duplicateRejections += 1;
    logLine = 'duplicate release rejected; no extra credit or advance';
  }
  render();
}

function watchTo(index) {
  pause();
  transport.seek(index);
  logLine = `watch/seek ${index}: preview only, no ticket and no credit`;
  render();
}

function nextSegment() {
  pause();
  transport.enterSegment('discussion');
  logLine = 'explicit outer Next entered discussion';
  render();
}

const actions = {
  play,
  pause,
  'release-pass-button': releaseAssistedPass,
  stale: releaseStale,
  duplicate: releaseDuplicate,
  watch: () => watchTo(5),
  'watch-barrier-button': () => watchTo(2),
  next: nextSegment,
  attemptA: () => startAttempt({ attemptId: 'attempt-a', submissionGeneration: 1 }),
  attemptB: () => startAttempt({ attemptId: 'attempt-b', submissionGeneration: 2 }),
  store: releaseStoredCompletion
};

for (const [id, action] of Object.entries({
  'play-button': actions.play,
  'pause-button': actions.pause,
  'release-pass-button': actions['release-pass-button'],
  'stale-button': actions.stale,
  'duplicate-button': actions.duplicate,
  'watch-button': actions.watch,
  'watch-barrier-button': actions['watch-barrier-button'],
  'next-segment-button': actions.next,
  'attempt-a-button': actions.attemptA,
  'attempt-b-button': actions.attemptB,
  'release-stored-button': actions.store
})) {
  document.getElementById(id).addEventListener('click', action);
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.code === 'Space' || key === ' ') {
    event.preventDefault();
    if (playing) {
      pause();
    } else {
      play();
    }
    return;
  }
  const byKey = {
    r: actions['release-pass-button'],
    x: actions.stale,
    s: actions.watch,
    n: actions.next,
    a: actions.attemptA,
    b: actions.attemptB,
    v: actions.store
  };
  if (byKey[key]) {
    event.preventDefault();
    byKey[key]();
  }
});

const resolvedPackageUrl = import.meta.resolve('@chatwright/player-core');
elements.resolved.textContent = resolvedPackageUrl;

window.__proof = {
  snapshot() {
    return {
      status: transport.state.status,
      cursor: transport.state.cursor,
      segmentId: transport.state.segmentId,
      waiting: transport.state.wait !== null,
      ticketId: transport.state.wait?.id ?? null,
      canAdvance: transport.state.canAdvance,
      messages: visibleMessages(),
      counters: { ...counters },
      context: {
        attemptId: context.attemptId,
        submissionGeneration: context.submissionGeneration,
        authorityGeneration: context.authorityGeneration,
        challengeId: context.challengeId,
        challengeRevision: context.challengeRevision,
        checkpointId: context.checkpointId
      },
      playing,
      resolvedPackageUrl,
      logLine,
      transcriptCount: Number(elements.transcript.dataset.count ?? 0),
      statusText: elements.status.textContent,
      statusAttribute: elements.status.dataset.status
    };
  }
};

render();
