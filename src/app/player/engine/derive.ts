import {
  BundleActor,
  BundleAnchor,
  BundleAnnotation,
  BundleRun,
  CampaignFinding,
  PlatformAction,
  PlatformJournalEntry
} from '../model/bundle.types';
import { messageKey } from './animation';
import { Step } from './timeline';

/**
 * Pure derivations over the *whole* run (independent of the playhead):
 * provenance lineage, derived markers, roster attribution and anchor
 * resolution. Keeping these playhead-independent means the click-to-provenance
 * inspector and the marker bar are stable and testable, and never depend on
 * how far playback has progressed.
 */

/* ------------------------------------------------------------------ roster */

export interface ResolvedActor {
  actor: BundleActor | null;
  displayName: string;
  fromId: number;
}

/**
 * Resolve a journal entry's FromID to a roster actor via
 * platformIdentities[platform].userId. FromID 0/absent → unattributed
 * (rendered neutrally, never crash).
 */
export function attribution(
  run: BundleRun,
  fromId: number
): ResolvedActor {
  if (!fromId) {
    return { actor: null, displayName: 'Unattributed', fromId };
  }
  for (const actor of run.actors ?? []) {
    for (const identity of Object.values(actor.platformIdentities ?? {})) {
      if (identity.userId === fromId) {
        return {
          actor,
          displayName: actor.name ?? actor.id,
          fromId
        };
      }
    }
  }
  return { actor: null, displayName: `#${fromId}`, fromId };
}

/* --------------------------------------------------------------- lineage */

export interface LineageVersion {
  entryIndex: number;
  version: number;
  text: string;
  actions: PlatformAction[][];
  at: string;
  edit: boolean;
}

export interface ActionPress {
  entryIndex: number;
  actionId: string;
  actionLabel: string;
  at: string;
  fromId: number;
  /** The bot entry (message/edit) that first followed this press, if any. */
  response: { entryIndex: number; messageId: number; version: number; text: string } | null;
}

export interface MessageLineage {
  chatId: number;
  messageId: number;
  versions: LineageVersion[];
  presses: ActionPress[];
}

function actionLabelFor(entries: PlatformJournalEntry[], refMessageId: number, actionId: string): string {
  for (const entry of entries) {
    if (entry.messageId === refMessageId && entry.actions) {
      for (const row of entry.actions) {
        for (const action of row) {
          if (action.id === actionId) {
            return action.label;
          }
        }
      }
    }
  }
  return actionId;
}

/**
 * Full lineage of one logical message: every version (original + edits) in
 * order, plus every action press that targeted it and the bot response that
 * followed each press.
 */
export function messageLineage(
  run: BundleRun,
  chatId: number,
  messageId: number
): MessageLineage {
  const entries = run.chats?.find((chat) => chat.chatId === chatId)?.entries ?? [];
  const versions: LineageVersion[] = [];
  const presses: ActionPress[] = [];

  entries.forEach((entry, entryIndex) => {
    if (entry.kind === 'message' && entry.messageId === messageId) {
      versions.push({
        entryIndex,
        version: entry.version,
        text: entry.text,
        actions: entry.actions ?? [],
        at: entry.at,
        edit: entry.version > 0
      });
    }
    if (entry.kind === 'action' && entry.refMessageId === messageId) {
      // First bot entry after this press is the callback's visible effect.
      let response: ActionPress['response'] = null;
      for (let j = entryIndex + 1; j < entries.length; j++) {
        const next = entries[j];
        if (next.direction === 'bot' && next.kind === 'message') {
          response = {
            entryIndex: j,
            messageId: next.messageId,
            version: next.version,
            text: next.text
          };
          break;
        }
      }
      presses.push({
        entryIndex,
        actionId: entry.text,
        actionLabel: actionLabelFor(entries, messageId, entry.text),
        at: entry.at,
        fromId: entry.fromId,
        response
      });
    }
  });

  return { chatId, messageId, versions, presses };
}

/**
 * For a bot message inside an ai-goal part: the loop event whose observation
 * first saw this message, and what the actor proposed next. Links the
 * transcript to the AI reasoning as a first-class relationship.
 */
export function loopEventForBotMessage(
  run: BundleRun,
  chatId: number,
  messageId: number
): { partIndex: number; eventIndex: number } | null {
  const parts = run.parts ?? [];
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];
    if (part.kind !== 'ai-goal' || !part.aiGoal) {
      continue;
    }
    // Find the observation that first contains this message id, then the
    // event that observed at that sequence (or the next one).
    const observations = part.aiGoal.observations ?? [];
    let seenAtSequence = Number.POSITIVE_INFINITY;
    for (const retained of observations) {
      const obs = retained.observation;
      if (obs.chat?.chatId !== chatId) {
        continue;
      }
      const has = (obs.messages ?? []).some((m) => idMatches(m.id, messageId));
      if (has) {
        seenAtSequence = Math.min(seenAtSequence, obs.sequence);
      }
    }
    const events = part.aiGoal.events ?? [];
    // Prefer the event that observed exactly the sequence the message appeared
    // in; otherwise the first event whose observation sequence >= it.
    let best = -1;
    for (let i = 0; i < events.length; i++) {
      if (events[i].observationSequence >= seenAtSequence) {
        best = i;
        break;
      }
    }
    if (best >= 0) {
      return { partIndex, eventIndex: best };
    }
  }
  return null;
}

/** One row of the inspector's "Observed by" section. */
export interface ObservedByRow {
  partIndex: number;
  partTitle: string;
  actorId: string;
  actorName: string;
  eventIndex: number;
  /** What the actor proposed at the moment it observed the message. */
  proposedNext: string;
  at: string;
}

/** Human summary of a proposal ("Send: …", "Click: …", "Mark task done", …). */
export function summariseProposal(proposal: {
  kind: string;
  text: string;
  actionId: string;
}): string {
  switch (proposal.kind) {
    case 'send-text':
      return `Send "${proposal.text}"`;
    case 'click':
      return `Click ${proposal.actionId}`;
    case 'task-done':
      return 'Mark task done';
    case 'give-up':
      return 'Give up';
    default:
      return proposal.kind;
  }
}

/**
 * Every ai-goal part whose retained observations include this message, with the
 * loop event that saw it and what the actor proposed next. One row per part
 * (there can be several); empty when no AI part observed the message — the
 * inspector then omits the section entirely.
 */
export function observedByParts(
  run: BundleRun,
  chatId: number,
  messageId: number
): ObservedByRow[] {
  const rows: ObservedByRow[] = [];
  const parts = run.parts ?? [];

  parts.forEach((part, partIndex) => {
    if (part.kind !== 'ai-goal' || !part.aiGoal) {
      return;
    }
    const observations = part.aiGoal.observations ?? [];
    let seenAtSequence = Number.POSITIVE_INFINITY;
    for (const retained of observations) {
      const obs = retained.observation;
      if (obs.chat?.chatId !== chatId) {
        continue;
      }
      if ((obs.messages ?? []).some((m) => idMatches(m.id, messageId))) {
        seenAtSequence = Math.min(seenAtSequence, obs.sequence);
      }
    }
    if (!Number.isFinite(seenAtSequence)) {
      return;
    }
    const events = part.aiGoal.events ?? [];
    let eventIndex = events.findIndex((e) => e.observationSequence >= seenAtSequence);
    if (eventIndex < 0 && events.length > 0) {
      eventIndex = events.length - 1;
    }
    if (eventIndex < 0) {
      return;
    }
    const actorId = part.aiGoal.actorId;
    const actor = (run.actors ?? []).find((a) => a.id === actorId) ?? null;
    rows.push({
      partIndex,
      partTitle: part.aiGoal.goal?.title || part.title || part.id,
      actorId,
      actorName: actor?.name ?? actorId,
      eventIndex,
      proposedNext: summariseProposal(events[eventIndex].proposal),
      at: events[eventIndex].at
    });
  });

  return rows;
}

/* ------------------------------------------------------------ actor stats */

export interface ActorStats {
  messagesSent: number;
  clicks: number;
  editsReceived: number;
  isAI: boolean;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  models: string[];
}

/**
 * Per-actor statistics computed from the whole bundle: messages sent, clicks /
 * callbacks, edits received (edits landing in a chat the actor takes part in,
 * authored by someone else), and — for AI actors — token usage, call count and
 * models drawn from the loop events of parts they ran.
 */
export function actorStats(run: BundleRun, actor: BundleActor): ActorStats {
  const userIds = new Set(
    Object.values(actor.platformIdentities ?? {}).map((identity) => identity.userId)
  );
  const isAI = actor.type === 'ai-agent' || actor.type === 'replay';

  let messagesSent = 0;
  let clicks = 0;
  let editsReceived = 0;

  for (const chat of run.chats ?? []) {
    const entries = chat.entries ?? [];
    const participates = entries.some((e) => userIds.has(e.fromId));
    for (const entry of entries) {
      const mine = userIds.has(entry.fromId);
      if (entry.kind === 'message' && entry.version === 0 && mine) {
        messagesSent++;
      } else if (entry.kind === 'action' && mine) {
        clicks++;
      } else if (entry.kind === 'message' && entry.version > 0 && participates && !mine) {
        editsReceived++;
      }
    }
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let calls = 0;
  const models = new Set<string>();

  for (const part of run.parts ?? []) {
    if (part.kind !== 'ai-goal' || part.aiGoal?.actorId !== actor.id) {
      continue;
    }
    for (const event of part.aiGoal.events ?? []) {
      inputTokens += event.usage.inputTokens || 0;
      outputTokens += event.usage.outputTokens || 0;
      calls++;
      if (event.usage.model) {
        models.add(event.usage.model);
      }
    }
  }
  for (const model of actor.provider?.modelIds ?? []) {
    models.add(model);
  }

  return {
    messagesSent,
    clicks,
    editsReceived,
    isAI,
    inputTokens,
    outputTokens,
    calls,
    models: [...models].sort()
  };
}

/**
 * Observation message ids are opaque platform strings (e.g. "msg2"); journal
 * message ids are integers (e.g. 2). Match loosely by trailing digits so the
 * transcript↔reasoning link survives either convention.
 */
function idMatches(observationId: string, messageId: number): boolean {
  if (observationId === String(messageId)) {
    return true;
  }
  const digits = observationId.match(/\d+/g);
  return !!digits && digits[digits.length - 1] === String(messageId);
}

/* --------------------------------------------------------------- markers */

export type MarkerKind = 'part' | 'task' | 'finding' | 'bookmark';

export interface Marker {
  id: string;
  kind: MarkerKind;
  title: string;
  detail: string;
  /** Timeline index to fast-forward to. */
  stepIndex: number;
  /** Severity styling class for findings. */
  severity?: string;
  findingKind?: string;
}

function stepIndexForAnchor(timeline: Step[], anchor: BundleAnchor): number {
  // Prefer the exact journal step; fall back to the first step of that chat.
  let fallback = -1;
  for (const step of timeline) {
    if (step.kind !== 'journal' || step.chatId !== anchor.chatId) {
      continue;
    }
    if (fallback < 0) {
      fallback = step.index;
    }
    if (step.entryIndex === anchor.entryIndex) {
      return step.index;
    }
  }
  return fallback;
}

function stepIndexForEvent(timeline: Step[], partIndex: number, eventIndex: number): number {
  for (const step of timeline) {
    if (step.kind === 'ai-beat' && step.partIndex === partIndex && step.eventIndex === eventIndex) {
      return step.index;
    }
  }
  return -1;
}

/**
 * Derived milestone markers + explicit bookmarks, in timeline order. Part
 * boundaries, task completions (from loop events) and findings (from the
 * report) are derived from bundle content; bookmarks are explicit.
 */
export function deriveMarkers(run: BundleRun, timeline: Step[]): Marker[] {
  const markers: Marker[] = [];
  const parts = run.parts ?? [];

  // Part-boundary markers (chapters).
  let lastPart = -1;
  for (const step of timeline) {
    if (step.partIndex !== lastPart) {
      lastPart = step.partIndex;
      markers.push({
        id: `part:${step.partId}`,
        kind: 'part',
        title: step.partTitle,
        detail: `Chapter · ${step.partKind}`,
        stepIndex: step.index
      });
    }
  }

  // Task completions + findings from ai-goal reports.
  parts.forEach((part, partIndex) => {
    if (part.kind !== 'ai-goal' || !part.aiGoal) {
      return;
    }
    (part.aiGoal.events ?? []).forEach((event, eventIndex) => {
      if (event.action?.kind === 'task-completed' || event.action?.kind === 'task-given-up') {
        const stepIndex = stepIndexForEvent(timeline, partIndex, eventIndex);
        if (stepIndex >= 0) {
          const done = event.action.kind === 'task-completed';
          markers.push({
            id: `task:${part.id}:${eventIndex}`,
            kind: 'task',
            title: done ? `Task complete · ${event.taskId}` : `Task given up · ${event.taskId}`,
            detail: event.action.detail || (done ? 'Success criteria met' : 'Actor gave up'),
            stepIndex,
            severity: done ? 'ok' : 'warn'
          });
        }
      }
    });

    (part.aiGoal.report?.findings ?? []).forEach((finding, i) => {
      const stepIndex = findingStepIndex(timeline, partIndex, finding);
      markers.push({
        id: `finding:${part.id}:${i}`,
        kind: 'finding',
        title: findingTitle(finding.kind),
        detail: finding.summary,
        stepIndex: stepIndex >= 0 ? stepIndex : 0,
        severity: findingSeverity(finding.kind),
        findingKind: finding.kind
      });
    });
  });

  // Explicit bookmarks.
  for (const bookmark of run.bookmarks ?? []) {
    markers.push({
      id: `bookmark:${bookmark.id}`,
      kind: 'bookmark',
      title: bookmark.title,
      detail: 'Bookmark',
      stepIndex: stepIndexForAnchor(timeline, bookmark.anchor)
    });
  }

  return markers.sort((a, b) => a.stepIndex - b.stepIndex);
}

function findingStepIndex(timeline: Step[], partIndex: number, finding: CampaignFinding): number {
  const eventIndex = finding.evidence?.loopEventIndexes?.[0];
  if (eventIndex !== undefined) {
    // loopEventIndexes reference LoopEvent.Index (== eventIndex in our order).
    const byIndex = stepIndexForEvent(timeline, partIndex, eventIndex);
    if (byIndex >= 0) {
      return byIndex;
    }
  }
  return -1;
}

function findingTitle(kind: string): string {
  switch (kind) {
    case 'verified-defect':
      return 'Verified defect';
    case 'ai-navigation-failure':
      return 'AI navigation failure';
    case 'coverage-gap':
      return 'Coverage gap';
    default:
      return kind || 'Finding';
  }
}

export function findingSeverity(kind: string): string {
  switch (kind) {
    case 'verified-defect':
      return 'danger';
    case 'ai-navigation-failure':
      return 'warn';
    case 'coverage-gap':
      return 'info';
    default:
      return 'info';
  }
}

/* --------------------------------------------------------- annotations */

export interface AnnotationPin {
  annotation: BundleAnnotation;
  stepIndex: number;
  /** Anchor resolves to a real journal entry in this run. */
  resolved: boolean;
  /** replyTo names an annotation this run actually carries. */
  danglingReply: boolean;
}

export interface AnnotationThread {
  root: AnnotationPin;
  replies: AnnotationPin[];
}

/**
 * Resolve annotations to timeline steps and group into reply threads. Dangling
 * anchors (entry out of range) and dangling replyTo (unknown id) are flagged,
 * never dropped and never a crash.
 */
export function resolveAnnotations(run: BundleRun, timeline: Step[]): AnnotationPin[] {
  const annotations = run.annotations ?? [];
  const ids = new Set(annotations.map((a) => a.id));
  return annotations.map((annotation) => {
    const stepIndex = stepIndexForAnchor(timeline, annotation.anchor);
    const entries = run.chats?.find((c) => c.chatId === annotation.anchor.chatId)?.entries ?? [];
    const resolved =
      annotation.anchor.entryIndex >= 0 && annotation.anchor.entryIndex < entries.length;
    return {
      annotation,
      stepIndex,
      resolved,
      danglingReply: !!annotation.replyTo && !ids.has(annotation.replyTo)
    };
  });
}

export function threadAnnotations(pins: AnnotationPin[]): AnnotationThread[] {
  const byId = new Map(pins.map((pin) => [pin.annotation.id, pin]));
  const threads: AnnotationThread[] = [];
  const rootOf = new Map<string, AnnotationThread>();

  for (const pin of pins) {
    const replyTo = pin.annotation.replyTo;
    if (!replyTo || !byId.has(replyTo)) {
      const thread: AnnotationThread = { root: pin, replies: [] };
      rootOf.set(pin.annotation.id, thread);
      threads.push(thread);
    }
  }
  for (const pin of pins) {
    const replyTo = pin.annotation.replyTo;
    if (replyTo && byId.has(replyTo)) {
      // Attach to the nearest known ancestor thread.
      let cursor: string | undefined = replyTo;
      const guard = new Set<string>();
      while (cursor && byId.has(cursor) && !rootOf.has(cursor) && !guard.has(cursor)) {
        guard.add(cursor);
        cursor = byId.get(cursor)!.annotation.replyTo;
      }
      const thread = cursor ? rootOf.get(cursor) : undefined;
      (thread ?? threads[0])?.replies.push(pin);
    }
  }
  return threads;
}

/** Anchor → the message key it pins (when messageId is present). */
export function anchorMessageKey(anchor: BundleAnchor): string | null {
  return anchor.messageId ? messageKey(anchor.chatId, anchor.messageId) : null;
}

/**
 * Resolve an anchor to the message key it belongs to, using its explicit
 * messageId when present, otherwise the journal entry at entryIndex (a message
 * entry contributes its own MessageID, an action entry its RefMessageID).
 * Returns null when the anchor does not resolve to any message (dangling).
 */
export function resolveAnchorMessageKey(run: BundleRun, anchor: BundleAnchor): string | null {
  if (anchor.messageId) {
    return messageKey(anchor.chatId, anchor.messageId);
  }
  const entries = run.chats?.find((c) => c.chatId === anchor.chatId)?.entries ?? [];
  const entry = entries[anchor.entryIndex];
  if (!entry) {
    return null;
  }
  if (entry.kind === 'message' && entry.messageId) {
    return messageKey(anchor.chatId, entry.messageId);
  }
  if (entry.kind === 'action' && entry.refMessageId) {
    return messageKey(anchor.chatId, entry.refMessageId);
  }
  return null;
}
