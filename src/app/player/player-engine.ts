import { Injectable, OnDestroy, computed, signal } from '@angular/core';

import {
  AiCursor,
  AnnotationPin,
  AnnotationThread,
  BASE_TEMPO,
  Bundle,
  BundleRun,
  Chapter,
  Marker,
  PresentationPlan,
  PresentationState,
  PresentationTransport,
  PresentationWaitTicket,
  SettledState,
  Step,
  aiCursorAt,
  buildTimeline,
  chaptersOf,
  deriveMarkers,
  frameDelayMs,
  resolveAnnotations,
  settledStateAt,
  threadAnnotations
} from '@chatwright/player-core';

/** Preset speed stops (0.2× / 0.5× / 1× / 2× / 4×). Rebased in round 2 so 1×
 *  is a calmer, at-least-2×-slower pace — see @chatwright/player-core's tempo. */
export const SPEED_STOPS = [0.2, 0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEED_STOPS)[number];

/** Live, transient message-bar-typing state for the compose-and-send primitive. */
export interface MessageBarTyping {
  chatId: number;
  actor: string;
  text: string;
  chars: number;
}

/**
 * The playback engine: a signal-driven virtual clock over a run bundle.
 *
 * Design split that makes the whole thing testable and lux at once:
 *   - Pure layer (engine/*.ts): buildTimeline + settledStateAt + derivations.
 *     No Angular, no timers, no animation — a pure function of (run, index).
 *   - This service: signals, the virtual clock, and *transient* animation
 *     state (which step is currently animating, live message bar typing).
 *
 * Settled state is always `settledStateAt(timeline, stepIndex)` — derived
 * purely from the integer index. Animations are decorative overlays keyed off
 * `animatingIndex`, which is only set during continuous forward playback.
 * Prev/Next/seek clear it, so they land on settled state instantly and never
 * wait on an animation (founder requirement).
 */
@Injectable()
export class PlayerEngine implements OnDestroy {
  private readonly _bundle = signal<Bundle | null>(null);
  private readonly _runIndex = signal(0);
  private readonly _timeline = signal<Step[]>([]);

  readonly stepIndex = signal(-1);
  readonly isPlaying = signal(false);
  readonly speed = signal<Speed>(1);
  readonly reducedMotion = signal(false);

  /** Set when play() is called against an empty timeline (no bundle loaded
   *  yet, or a run with zero steps) — consumed by selectRun() below, which
   *  starts playback for real the moment a non-empty timeline arrives,
   *  instead of play() silently no-op'ing forever. */
  private pendingPlay = false;

  /** Chat currently shown in the transcript (multi-chat runs are real). */
  private readonly _activeChatId = signal<number | null>(null);
  /** When set, auto-follow is suspended and the transcript holds this chat. */
  private readonly _pinnedChatId = signal<number | null>(null);
  readonly activeChatId = this._activeChatId.asReadonly();
  readonly pinnedChatId = this._pinnedChatId.asReadonly();

  /** The step index whose entrance animation is currently playing (or null). */
  readonly animatingIndex = signal<number | null>(null);
  /** Live message bar typing for a compose-and-send primitive (or null). */
  readonly messageBarTyping = signal<MessageBarTyping | null>(null);

  /**
   * The current caller-bound presentation wait, if any. The ticket is opaque:
   * only `releasePresentationWait` accepts it, and only the exact current
   * ticket is accepted, once. No result, grading or attempt data lives here.
   */
  readonly wait = signal<PresentationWaitTicket | null>(null);
  readonly waiting = computed(() => this.wait() !== null);

  private transport = new PresentationTransport(0);
  private plan: PresentationPlan | null = null;

  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private typingRaf: number | null = null;
  /** Invalidates already-queued frame callbacks even if a host delivers late. */
  private frameGeneration = 0;

  readonly bundle = this._bundle.asReadonly();
  readonly runIndex = this._runIndex.asReadonly();
  readonly timeline = this._timeline.asReadonly();

  readonly run = computed<BundleRun | null>(() => {
    const bundle = this._bundle();
    if (!bundle || !bundle.runs) {
      return null;
    }
    return bundle.runs[this._runIndex()] ?? null;
  });

  readonly stepCount = computed(() => this._timeline().length);
  readonly lastIndex = computed(() => this._timeline().length - 1);
  readonly atEnd = computed(() => this.stepIndex() >= this.lastIndex());

  /** Every chat id in the current run, in the order the run lists them. */
  readonly chatIds = computed<number[]>(() => (this.run()?.chats ?? []).map((c) => c.chatId));

  /** The chat the current step happens in (independent of any pin). */
  readonly currentChatId = computed<number | null>(() => this.chatIdForIndex(this.stepIndex()));

  readonly currentStep = computed<Step | null>(() => {
    const i = this.stepIndex();
    const timeline = this._timeline();
    return i >= 0 && i < timeline.length ? timeline[i] : null;
  });

  readonly settled = computed<SettledState>(() =>
    settledStateAt(this._timeline(), this.stepIndex())
  );

  readonly chapters = computed<Chapter[]>(() => chaptersOf(this._timeline()));

  readonly markers = computed<Marker[]>(() => {
    const run = this.run();
    return run ? deriveMarkers(run, this._timeline()) : [];
  });

  readonly annotationPins = computed<AnnotationPin[]>(() => {
    const run = this.run();
    return run ? resolveAnnotations(run, this._timeline()) : [];
  });

  readonly annotationThreads = computed<AnnotationThread[]>(() =>
    threadAnnotations(this.annotationPins())
  );

  readonly aiCursor = computed<AiCursor>(() => aiCursorAt(this._timeline(), this.stepIndex()));

  readonly progress = computed(() => {
    const last = this.lastIndex();
    if (last <= 0) {
      return this.stepIndex() >= 0 ? 1 : 0;
    }
    return Math.max(0, this.stepIndex()) / last;
  });

  /* ------------------------------------------------------------ loading */

  load(bundle: Bundle, runIndex = 0): void {
    // Prepare (and validate) the whole next context before publishing any of
    // it. If the new timeline cannot carry the retained plan, the call fails
    // with the prior bundle, timeline, transport, cursor and wait untouched.
    const prepared = this.prepareRunContext(bundle, runIndex, -1);
    this.commitRunContext(bundle, runIndex, prepared, true);
    this.reanchorPendingPlay();
  }

  selectRun(runIndex: number): void {
    const bundle = this._bundle();
    const prepared = this.prepareRunContext(bundle, runIndex, -1);
    this.commitRunContext(bundle, runIndex, prepared, false);
    this.reanchorPendingPlay();
  }

  /**
   * Declare caller-owned presentation bindings (segments and barriers). A
   * barrier only pauses presentation: the caller decides whether an external
   * result matches and then releases the ticket. Passing `null` restores
   * ordinary unsegmented Studio playback.
   *
   * This is a context change: any open wait and scheduled advance are revoked.
   */
  setPresentationPlan(plan: PresentationPlan | null): void {
    const next = new PresentationTransport(this._timeline().length, plan);
    this.pause();
    this.transport.dispose();
    this.transport = next;
    // Retain the transport's validated snapshot, never the caller's mutable
    // arrays/records: a later selectRun/patchRun rebuild must not see edits.
    this.plan = next.bindings;
    this.applyCursor(next.seek(-1));
  }

  /**
   * Explicit outer Next across a declared segment boundary. The presentation
   * opens the segment's first step and stays paused until Play.
   */
  enterPresentationSegment(segmentId: string): void {
    this.pause();
    this.applyCursor(this.transport.enterSegment(segmentId));
  }

  /**
   * Release the exact current presentation ticket. The caller has already
   * validated its own external result; the engine only resumes playback that
   * was running when the wait opened. Release while paused marks the wait
   * satisfied and schedules nothing.
   */
  releasePresentationWait(ticket: PresentationWaitTicket): boolean {
    const accepted = this.transport.releaseWait(ticket);
    if (!accepted) {
      return false;
    }
    this.wait.set(null);
    if (this.isPlaying()) {
      this.scheduleNextFrame();
    }
    return true;
  }

  /* ------------------------------------------------------------- chats */

  /** Manually show a chat. Does not pin — auto-follow may switch away on the
   *  next step unless the user also pins. */
  setActiveChat(chatId: number): void {
    this._activeChatId.set(chatId);
  }

  /** Pin the current chat (hold it while stepping) or release the pin. */
  togglePin(): void {
    this._pinnedChatId.set(this._pinnedChatId() === null ? this._activeChatId() : null);
  }

  /** Pin a specific chat: unpin if it is already the pinned chat, otherwise
   *  make it active and pin it (so clicking pin on B while A is pinned repins
   *  to B rather than merely unpinning). */
  pinChat(chatId: number): void {
    if (this._pinnedChatId() === chatId) {
      this._pinnedChatId.set(null);
    } else {
      this._activeChatId.set(chatId);
      this._pinnedChatId.set(chatId);
    }
  }

  /** Follow the chat the current step happens in, unless the user pinned one. */
  private syncActiveChat(): void {
    if (this._pinnedChatId() !== null) {
      return;
    }
    const chatId = this.chatIdForIndex(this.stepIndex());
    if (chatId !== null) {
      this._activeChatId.set(chatId);
    }
  }

  /** The chat a step belongs to: a journal step's own chat, or, for an AI beat,
   *  the chat its observation was looking at. */
  private chatIdForStep(step: Step): number | null {
    if (step.kind === 'journal') {
      return step.chatId;
    }
    const part = this.run()?.parts?.[step.partIndex];
    const observations = part?.aiGoal?.observations ?? [];
    const match = observations.find((o) => o.sequence === step.observationSequence);
    return match?.observation.chat?.chatId ?? null;
  }

  /** Walk back from `index` to the nearest step that resolves to a chat. */
  private chatIdForIndex(index: number): number | null {
    const timeline = this._timeline();
    for (let i = Math.min(index, timeline.length - 1); i >= 0; i--) {
      const chatId = this.chatIdForStep(timeline[i]);
      if (chatId !== null) {
        return chatId;
      }
    }
    return this.chatIds()[0] ?? null;
  }

  /** Replace the current run in place (e.g. after adding an annotation). */
  patchRun(next: BundleRun): void {
    const bundle = this._bundle();
    if (!bundle || !bundle.runs) {
      return;
    }
    const wasPlaying = this.isPlaying();
    const cursor = this.stepIndex();
    const runs = [...bundle.runs];
    runs[this._runIndex()] = next;
    const nextBundle = { ...bundle, runs };
    // Validate the replacement context before publishing any of it.
    const prepared = this.prepareRunContext(nextBundle, this._runIndex(), cursor);
    this.clearTimers();
    this._bundle.set(nextBundle);
    this._timeline.set(prepared.timeline);
    // A new timeline is a context change: revoke the open wait, keep the
    // presentation position (clamped) and re-arm playback only if it was live.
    this.adoptTransport(prepared.transport);
    this.clearTransient();
    if (wasPlaying) {
      this.scheduleNextFrame();
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.stopTyping();
    this.transport.dispose();
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion.set(value);
    if (value) {
      this.clearTransient();
    }
  }

  /* ---------------------------------------------------------- transport */

  play(): void {
    if (this.stepCount() === 0) {
      // Defer instead of dropping the request: selectRun() starts playback
      // for real as soon as a non-empty timeline arrives. isPlaying stays
      // false meanwhile, so the transport bar shows Play (not a misleading
      // Pause) while there's genuinely nothing playing yet.
      this.pendingPlay = true;
      return;
    }
    this.pendingPlay = false;
    // Only ordinary unsegmented playback restarts at the physical end.
    // A released final wait must finish its segment, and segment changes
    // remain owned by the caller's explicit navigation.
    if (this.atEnd() && this.transport.state.segmentId === null) {
      this.applyCursor(this.transport.seek(-1));
      this.clearTransient();
    }
    this.isPlaying.set(true);
    this.scheduleNextFrame();
  }

  pause(): void {
    this.pendingPlay = false;
    this.isPlaying.set(false);
    this.clearTimers();
    this.clearTransient();
    // A live ticket survives pause on purpose: pausing must not discard a
    // valid external wait, and a later release still requires explicit Play.
  }

  toggle(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop(): void {
    this.isPlaying.set(false);
    this.clearTimers();
    this.clearTransient();
  }

  next(): void {
    this.pause();
    // advance() is barrier-aware: manual stepping cannot substitute for a
    // caller release or for an explicit segment change.
    this.applyCursor(this.transport.advance());
  }

  prev(): void {
    this.pause();
    this.seekTo(this.stepIndex() - 1);
  }

  restart(): void {
    this.pause();
    this.seekTo(-1);
  }

  /**
   * Seek to an exact step index. Always lands on settled state instantly.
   *
   * A seek is a watch operation: it revokes any scheduled advance and any open
   * wait ticket, never opens one and never grants credit. Playback is paused so
   * an old clock tick cannot keep moving from the new position.
   */
  seekTo(index: number): void {
    this.pause();
    this.applyCursor(this.transport.seek(index));
  }

  jumpToMarker(marker: Marker): void {
    this.pause();
    this.seekTo(marker.stepIndex);
  }

  /** Seek to the first beat of a loop event (transcript → reasoning jump). */
  seekToEvent(partIndex: number, eventIndex: number): void {
    const step = this._timeline().find(
      (s) => s.kind === 'ai-beat' && s.partIndex === partIndex && s.eventIndex === eventIndex
    );
    if (step) {
      this.pause();
      this.seekTo(step.index);
    }
  }

  setSpeed(speed: Speed): void {
    this.speed.set(speed);
    if (this.isPlaying()) {
      this.scheduleNextFrame();
    }
  }

  /* --------------------------------------------------- virtual clock */

  private scheduleNextFrame(): void {
    this.clearTimers();
    if (!this.isPlaying()) {
      return;
    }
    const state = this.transport.state;
    if (state.status === 'waiting') {
      // Keep isPlaying true: the wait was reached during playback, so a valid
      // release resumes it. Doing nothing keeps waiting indefinitely.
      return;
    }
    if (state.status === 'segment-end' || state.status === 'ended' || state.status === 'disposed') {
      this.isPlaying.set(false);
      this.clearTransient();
      return;
    }
    const generation = this.frameGeneration;
    const delay = this.frameDelay(state.cursor + 1);
    this.frameTimer = setTimeout(() => {
      this.frameTimer = null;
      // A callback delivered after cancel (seek/load/pause/plan change) is
      // inert: it must not advance reconstructed state or reopen a wait.
      if (generation !== this.frameGeneration || !this.isPlaying()) {
        return;
      }
      this.applyState(this.transport.advance(), true);
      if (this.isPlaying()) {
        this.scheduleNextFrame();
      }
    }, delay);
  }

  private applyState(state: PresentationState, animate: boolean): void {
    this.applyCursor(state);
    if (!animate || state.cursor < 0 || this.reducedMotion()) {
      this.clearTransient();
      return;
    }
    const index = state.cursor;
    this.animatingIndex.set(index);
    const step = this._timeline()[index];
    if (step && step.kind === 'journal' && step.animation.primitive === 'compose-and-send') {
      this.runMessageBarTyping(step, index);
    } else {
      this.stopTyping();
    }
  }

  private applyCursor(state: PresentationState): void {
    this.stepIndex.set(state.cursor);
    this.wait.set(state.wait);
    this.syncActiveChat();
  }

  /**
   * Build and validate a run context without touching any published signal or
   * the live transport. Throws before the caller publishes anything if the
   * timeline cannot carry the retained plan.
   */
  private prepareRunContext(
    bundle: Bundle | null,
    runIndex: number,
    cursor: number
  ): { run: BundleRun | null; timeline: Step[]; transport: PresentationTransport } {
    const run = bundle?.runs?.[runIndex] ?? null;
    const timeline = buildTimeline(run);
    const transport = new PresentationTransport(timeline.length, this.plan);
    transport.seek(cursor);
    return { run, timeline, transport };
  }

  /**
   * Publish a prepared context atomically: no signal is written until every
   * fallible step has already succeeded.
   */
  private commitRunContext(
    bundle: Bundle | null,
    runIndex: number,
    prepared: { run: BundleRun | null; timeline: Step[]; transport: PresentationTransport },
    publishBundle: boolean
  ): void {
    this.stop();
    if (publishBundle) {
      this._bundle.set(bundle);
    }
    this._runIndex.set(runIndex);
    this._timeline.set(prepared.timeline);
    this.adoptTransport(prepared.transport);
    this._pinnedChatId.set(null);
    this._activeChatId.set(prepared.run?.chats?.[0]?.chatId ?? null);
  }

  /** Replace the live transport, revoking the previous lifetime's ticket. */
  private adoptTransport(next: PresentationTransport): void {
    this.transport.dispose();
    this.transport = next;
    this.wait.set(null);
    this.applyCursor(next.state);
  }

  private reanchorPendingPlay(): void {
    // Re-anchor a play() that arrived before this timeline did.
    if (this.pendingPlay && this._timeline().length > 0) {
      this.pendingPlay = false;
      this.play();
    }
  }

  /** Virtual-clock gap to the next step (ms), rebased and compressed by speed. */
  private frameDelay(index: number): number {
    const timeline = this._timeline();
    if (index <= 0) {
      return frameDelayMs(0, this.speed());
    }
    const prev = timeline[index - 1]?.atMs ?? 0;
    const curr = timeline[index]?.atMs ?? prev;
    return frameDelayMs(Math.abs(curr - prev), this.speed());
  }

  private runMessageBarTyping(
    step: Extract<Step, { kind: 'journal' }>,
    index: number
  ): void {
    this.stopTyping();
    const text = step.animation.typedText ?? step.entry.text;
    const actor = this.run()
      ? attributionName(this.run()!, step.entry.fromId)
      : 'User';
    if (!text) {
      return;
    }
    const perChar = (36 * BASE_TEMPO) / this.speed();
    const budget = Math.min(this.frameDelay(index) * 0.82, Math.max(320, text.length * perChar));
    const start = performance.now();
    this.messageBarTyping.set({ chatId: step.chatId, actor, text, chars: 0 });

    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = budget <= 0 ? 1 : Math.min(1, elapsed / budget);
      const chars = Math.round(ratio * text.length);
      const current = this.messageBarTyping();
      if (!current) {
        return;
      }
      this.messageBarTyping.set({ ...current, chars });
      if (ratio < 1) {
        this.typingRaf = requestAnimationFrame(tick);
      } else {
        // Typed out: the message bar clears and the bubble (already settled) lands.
        this.messageBarTyping.set(null);
        this.typingRaf = null;
      }
    };
    this.typingRaf = requestAnimationFrame(tick);
  }

  private stopTyping(): void {
    if (this.typingRaf !== null) {
      cancelAnimationFrame(this.typingRaf);
      this.typingRaf = null;
    }
    this.messageBarTyping.set(null);
  }

  private clearTimers(): void {
    this.frameGeneration += 1;
    if (this.frameTimer !== null) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private clearTransient(): void {
    this.animatingIndex.set(null);
    this.stopTyping();
  }
}

function attributionName(run: BundleRun, fromId: number): string {
  if (!fromId) {
    return 'User';
  }
  for (const actor of run.actors ?? []) {
    for (const identity of Object.values(actor.platformIdentities ?? {})) {
      if (identity.userId === fromId) {
        return actor.name ?? actor.id;
      }
    }
  }
  return 'User';
}
