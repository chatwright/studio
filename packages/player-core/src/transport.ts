/**
 * Presentation transport: a deterministic, timer-free cursor plus
 * caller-bound external waits.
 *
 * The transport owns *when* forward presentation may continue. It does not own
 * what a wait means: the caller declares segment ranges and barrier step
 * indexes, decides whether an external result is valid, and only then releases
 * the current opaque ticket. The transport never parses a result, never keeps a
 * completion registry and never performs the external action.
 *
 * Two invariants keep it honest:
 *
 *   - A seek is a preview. It may move anywhere, but it never opens a ticket,
 *     consumes a result or grants credit.
 *   - A wait belongs to one instance and one lifetime. Only the exact ticket
 *     object currently open can be released, exactly once.
 *
 * The host owns timers and rendering. This module has no clock, no scheduler,
 * no DOM access and no runtime dependencies.
 */

/** One caller-declared presentation segment: an inclusive step-index range. */
export interface PresentationSegment {
  readonly id: string;
  /** First step index shown by this segment. */
  readonly startIndex: number;
  /** Last step index shown by this segment. */
  readonly endIndex: number;
}

/**
 * A caller-declared barrier: forward presentation stops at `atIndex` until the
 * caller releases the current ticket. A barrier is a runtime presentation
 * binding, never a run-bundle wire field.
 */
export interface PresentationBarrier {
  readonly id: string;
  readonly segmentId: string;
  /** Step index the presentation waits on. */
  readonly atIndex: number;
}

/**
 * Caller-supplied bindings. Segments must cover the whole timeline exactly
 * once, in order: `[0, n-1]` with no gaps or overlaps, so the active segment is
 * always unambiguous. An empty plan means ordinary unsegmented playback.
 */
export interface PresentationPlan {
  readonly segments: readonly PresentationSegment[];
  readonly barriers: readonly PresentationBarrier[];
}

export type PresentationStatus =
  /** Not started, or a wait was released; forward advancement may continue. */
  | 'idle'
  /** A forward step just succeeded. */
  | 'running'
  /** A seek landed here; this is a preview, not a validated position. */
  | 'preview'
  /** Forward advancement is blocked on the current ticket. */
  | 'waiting'
  /** The active segment ended; only an explicit outer Next may continue. */
  | 'segment-end'
  /** The physical end of an unsegmented timeline. */
  | 'ended'
  /** The transport was disposed; every further operation is inert. */
  | 'disposed';

/**
 * Opaque capability for one live wait. It is meaningful only when it is the
 * exact object returned by `PresentationState.wait` on the same transport
 * lifetime. A structurally equal copy, a ticket from an earlier lifetime or a
 * ticket from another transport is rejected.
 */
export interface PresentationWaitTicket {
  /** Instance-local sequence; equal scalars across lifetimes do not match. */
  readonly id: number;
  readonly barrierId: string;
  readonly segmentId: string;
  readonly atIndex: number;
}

export interface PresentationState {
  /** Inclusive step index; `-1` is the empty pre-roll. */
  readonly cursor: number;
  readonly status: PresentationStatus;
  /** Segment containing the cursor, or the waiting barrier's segment. */
  readonly segmentId: string | null;
  /** The live ticket, or `null` when no wait is open. */
  readonly wait: PresentationWaitTicket | null;
  /** Whether one forward step is currently possible without caller action. */
  readonly canAdvance: boolean;
}

function fail(message: string): never {
  throw new RangeError(message);
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

interface NormalizedPlan {
  readonly segments: readonly PresentationSegment[];
  readonly barriers: readonly PresentationBarrier[];
}

function normalizePlan(stepCount: number, plan: PresentationPlan | null | undefined): NormalizedPlan {
  if (plan === null || plan === undefined) {
    return { segments: Object.freeze([]), barriers: Object.freeze([]) };
  }
  if (typeof plan !== 'object' || !Array.isArray(plan.segments) || !Array.isArray(plan.barriers)) {
    fail('presentation plan must have `segments` and `barriers` arrays');
  }

  const segments: PresentationSegment[] = [];
  const segmentIds = new Set<string>();

  for (const candidate of plan.segments) {
    if (typeof candidate !== 'object' || candidate === null) {
      fail('every presentation segment must be an object');
    }
    const { id, startIndex, endIndex } = candidate;
    if (typeof id !== 'string' || id.length === 0) {
      fail('every presentation segment needs a non-empty string id');
    }
    if (segmentIds.has(id)) {
      fail(`duplicate presentation segment id: ${id}`);
    }
    if (!isInteger(startIndex) || !isInteger(endIndex)) {
      fail(`segment ${id} bounds must be integers`);
    }
    if (startIndex < 0 || endIndex < startIndex) {
      fail(`segment ${id} has an invalid range`);
    }
    if (stepCount === 0 || endIndex > stepCount - 1) {
      fail(`segment ${id} range is outside the ${stepCount}-step timeline`);
    }
    segmentIds.add(id);
    segments.push(Object.freeze({ id, startIndex, endIndex }));
  }

  if (segments.length > 0) {
    if (segments[0].startIndex !== 0) {
      fail('presentation segments must start at step 0');
    }
    for (let index = 1; index < segments.length; index++) {
      const previous = segments[index - 1];
      const current = segments[index];
      if (current.startIndex !== previous.endIndex + 1) {
        fail('presentation segments must be ordered, contiguous and non-overlapping');
      }
    }
    if (segments[segments.length - 1].endIndex !== stepCount - 1) {
      fail('presentation segments must cover the whole timeline');
    }
  }

  const barriers: PresentationBarrier[] = [];
  const barrierIds = new Set<string>();
  const barrierIndexes = new Set<number>();
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));

  for (const candidate of plan.barriers) {
    if (typeof candidate !== 'object' || candidate === null) {
      fail('every presentation barrier must be an object');
    }
    const { id, segmentId, atIndex } = candidate;
    if (typeof id !== 'string' || id.length === 0) {
      fail('every presentation barrier needs a non-empty string id');
    }
    if (barrierIds.has(id)) {
      fail(`duplicate presentation barrier id: ${id}`);
    }
    if (!isInteger(atIndex)) {
      fail(`barrier ${id} step index must be an integer`);
    }
    const segment = segmentsById.get(segmentId);
    if (!segment) {
      fail(`barrier ${id} references unknown segment ${String(segmentId)}`);
    }
    if (atIndex < segment.startIndex || atIndex > segment.endIndex) {
      fail(`barrier ${id} is outside segment ${segmentId}`);
    }
    if (barrierIndexes.has(atIndex)) {
      fail(`more than one barrier is bound to step ${atIndex}`);
    }
    barrierIds.add(id);
    barrierIndexes.add(atIndex);
    barriers.push(Object.freeze({ id, segmentId, atIndex }));
  }

  return {
    segments: Object.freeze(segments),
    barriers: Object.freeze(barriers)
  };
}

/**
 * A pure presentation cursor with caller-gated barriers.
 *
 * The host calls `advance()` on its own clock tick, reads the returned state,
 * and schedules the next tick only when the state allows it. Reaching an
 * unreleased barrier returns `waiting` with a ticket; doing nothing keeps it
 * waiting. The caller releases the exact ticket only after its own validation
 * succeeds, and the host decides whether playback was already running.
 */
export class PresentationTransport {
  private readonly stepCount: number;
  private readonly segments: readonly PresentationSegment[];
  private readonly barriers: readonly PresentationBarrier[];
  private readonly segmented: boolean;
  private readonly segmentsById: ReadonlyMap<string, PresentationSegment>;

  private cursor = -1;
  private status: PresentationStatus = 'idle';
  private wait: PresentationWaitTicket | null = null;
  private ticketSequence = 0;
  private disposed = false;
  /** Released barrier ids for this lifetime; bounded by the plan's barrier count. */
  private readonly releasedBarriers = new Set<string>();

  constructor(stepCount: number, plan: PresentationPlan | null = null) {
    if (!isInteger(stepCount) || stepCount < 0) {
      fail('step count must be a non-negative integer');
    }
    const normalized = normalizePlan(stepCount, plan);
    this.stepCount = stepCount;
    this.segments = normalized.segments;
    this.barriers = normalized.barriers;
    this.segmented = this.segments.length > 0;
    this.segmentsById = new Map(this.segments.map((segment) => [segment.id, segment]));
  }

  get state(): PresentationState {
    return this.snapshot();
  }

  /**
   * Move the presentation cursor to an exact step index. This is a watch/seek
   * operation: it revokes any open ticket, never opens one and never records
   * credit. Finite indices are clamped to `[-1, stepCount - 1]`; a non-integer
   * or non-finite index is ignored and the current state is returned.
   */
  seek(index: number): PresentationState {
    if (this.disposed) {
      return this.snapshot();
    }
    if (!Number.isFinite(index) || !isInteger(index)) {
      return this.snapshot();
    }
    this.revokeWait();
    const clamped = Math.max(-1, Math.min(index, this.stepCount - 1));
    this.cursor = clamped;
    this.status = this.stepCount === 0 ? 'ended' : 'preview';
    return this.snapshot();
  }

  /**
   * Advance one step. Stops at an unreleased barrier (opening its ticket), at
   * the active segment's end (awaiting an explicit outer Next), or at the
   * physical end of an unsegmented timeline.
   *
   * If a preview seek moved past an unreleased barrier in the active segment,
   * this clamps back to the earliest such barrier instead of bypassing it.
   */
  advance(): PresentationState {
    if (this.disposed) {
      return this.snapshot();
    }
    if (this.stepCount === 0) {
      this.status = 'ended';
      return this.snapshot();
    }
    if (this.wait !== null) {
      return this.snapshot();
    }

    const segment = this.segmentAt(this.cursor);

    // A preview may have moved past an open barrier. Play consults it before
    // any segment-end or next-step decision, so seeking cannot bypass a wait.
    const crossedBarrier = this.firstUnreleasedBarrierAtOrBefore(this.cursor, segment);
    if (crossedBarrier !== null) {
      this.openWait(crossedBarrier);
      return this.snapshot();
    }

    if (segment !== null && this.cursor >= segment.endIndex) {
      this.status = 'segment-end';
      return this.snapshot();
    }
    if (segment === null && this.cursor >= this.stepCount - 1) {
      this.status = 'ended';
      return this.snapshot();
    }

    const next = this.cursor + 1;
    const nextBarrier = this.barrierAt(next);
    if (nextBarrier !== null) {
      this.openWait(nextBarrier);
      return this.snapshot();
    }

    this.cursor = next;
    this.status = 'running';
    return this.snapshot();
  }

  /**
   * Release the exact current ticket once. A valid release only marks the wait
   * satisfied: it never moves the cursor, schedules a frame or restarts
   * playback, so a host that was paused stays paused until an explicit Play.
   */
  releaseWait(ticket: PresentationWaitTicket): boolean {
    if (this.disposed || this.wait === null || ticket !== this.wait) {
      return false;
    }
    this.releasedBarriers.add(this.wait.barrierId);
    this.wait = null;
    this.status = 'idle';
    return true;
  }

  /**
   * Explicit outer Next: enter a declared segment and show its first step.
   * Chapter/segment changes never happen implicitly.
   */
  enterSegment(segmentId: string): PresentationState {
    if (this.disposed) {
      return this.snapshot();
    }
    const segment = this.segmentsById.get(segmentId);
    if (!segment) {
      fail(`unknown presentation segment: ${segmentId}`);
    }
    this.revokeWait();
    this.cursor = segment.startIndex;
    this.status = 'idle';
    return this.snapshot();
  }

  /**
   * Reset for a changed presentation context (new load, pins or authority).
   * Revokes the ticket and clears this lifetime's released barriers.
   */
  reset(): PresentationState {
    if (this.disposed) {
      return this.snapshot();
    }
    this.revokeWait();
    this.releasedBarriers.clear();
    this.cursor = -1;
    this.status = 'idle';
    return this.snapshot();
  }

  /** Revoke the ticket forever; every later operation is inert. Idempotent. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.wait = null;
    this.status = 'disposed';
    this.disposed = true;
  }

  private snapshot(): PresentationState {
    const segment = this.segmentAt(this.cursor);
    const wait = this.wait;
    const canAdvance =
      (this.status === 'idle' || this.status === 'running' || this.status === 'preview') &&
      this.stepCount > 0 &&
      this.cursor < (segment === null ? this.stepCount - 1 : segment.endIndex);
    return Object.freeze({
      cursor: this.cursor,
      status: this.status,
      segmentId: wait !== null ? wait.segmentId : segment === null ? null : segment.id,
      wait,
      canAdvance
    });
  }

  private segmentAt(cursor: number): PresentationSegment | null {
    if (!this.segmented) {
      return null;
    }
    if (cursor < 0) {
      return this.segments[0];
    }
    for (const segment of this.segments) {
      if (cursor >= segment.startIndex && cursor <= segment.endIndex) {
        return segment;
      }
    }
    return null;
  }

  private barrierAt(index: number): PresentationBarrier | null {
    for (const barrier of this.barriers) {
      if (barrier.atIndex === index && !this.releasedBarriers.has(barrier.id)) {
        return barrier;
      }
    }
    return null;
  }

  private firstUnreleasedBarrierAtOrBefore(
    cursor: number,
    segment: PresentationSegment | null
  ): PresentationBarrier | null {
    let found: PresentationBarrier | null = null;
    for (const barrier of this.barriers) {
      if (segment !== null && barrier.segmentId !== segment.id) {
        continue;
      }
      if (barrier.atIndex > cursor || this.releasedBarriers.has(barrier.id)) {
        continue;
      }
      if (found === null || barrier.atIndex < found.atIndex) {
        found = barrier;
      }
    }
    return found;
  }

  private openWait(barrier: PresentationBarrier): void {
    this.cursor = barrier.atIndex;
    this.wait = Object.freeze({
      id: ++this.ticketSequence,
      barrierId: barrier.id,
      segmentId: barrier.segmentId,
      atIndex: barrier.atIndex
    });
    this.status = 'waiting';
  }

  private revokeWait(): void {
    this.wait = null;
  }
}
