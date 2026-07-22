import { Injectable, OnDestroy, computed, signal } from '@angular/core';

import { Bundle, BundleRun } from './model/bundle.types';
import { AiCursor, aiCursorAt } from './engine/ai-cursor';
import {
  AnnotationPin,
  AnnotationThread,
  Marker,
  deriveMarkers,
  resolveAnnotations,
  threadAnnotations
} from './engine/derive';
import { SettledState, settledStateAt } from './engine/settled';
import { Chapter, Step, buildTimeline, chaptersOf } from './engine/timeline';

/** Preset speed stops (0.5× / 1× / 2× / 4×). */
export const SPEED_STOPS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEED_STOPS)[number];

const MIN_FRAME_MS = 380;
const MAX_FRAME_MS = 2600;

/** Live, transient composer-typing state for the compose-and-send primitive. */
export interface ComposerTyping {
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
 *     state (which step is currently animating, live composer typing).
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

  /** The step index whose entrance animation is currently playing (or null). */
  readonly animatingIndex = signal<number | null>(null);
  /** Live composer typing for a compose-and-send primitive (or null). */
  readonly composerTyping = signal<ComposerTyping | null>(null);

  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private typingRaf: number | null = null;

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
    this.stop();
    this._bundle.set(bundle);
    this.selectRun(runIndex);
  }

  selectRun(runIndex: number): void {
    this.stop();
    this._runIndex.set(runIndex);
    const bundle = this._bundle();
    const run = bundle?.runs?.[runIndex] ?? null;
    this._timeline.set(buildTimeline(run));
    this.stepIndex.set(-1);
  }

  /** Replace the current run in place (e.g. after adding an annotation). */
  patchRun(next: BundleRun): void {
    const bundle = this._bundle();
    if (!bundle || !bundle.runs) {
      return;
    }
    const runs = [...bundle.runs];
    runs[this._runIndex()] = next;
    this._bundle.set({ ...bundle, runs });
    this._timeline.set(buildTimeline(next));
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.stopTyping();
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
      return;
    }
    if (this.atEnd()) {
      this.stepIndex.set(-1);
    }
    this.isPlaying.set(true);
    this.scheduleNextFrame();
  }

  pause(): void {
    this.isPlaying.set(false);
    this.clearTimers();
    this.clearTransient();
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
    this.seekTo(this.stepIndex() + 1);
  }

  prev(): void {
    this.pause();
    this.seekTo(this.stepIndex() - 1);
  }

  restart(): void {
    this.pause();
    this.seekTo(-1);
  }

  /** Seek to an exact step index. Always lands on settled state instantly. */
  seekTo(index: number): void {
    const clamped = Math.max(-1, Math.min(index, this.lastIndex()));
    this.clearTransient();
    this.stepIndex.set(clamped);
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
    const from = this.stepIndex();
    const to = from + 1;
    if (to > this.lastIndex()) {
      this.isPlaying.set(false);
      this.clearTransient();
      return;
    }
    const delay = this.frameDelay(to);
    this.frameTimer = setTimeout(() => {
      this.advanceTo(to);
      if (this.isPlaying()) {
        this.scheduleNextFrame();
      }
    }, delay);
  }

  private advanceTo(index: number): void {
    this.stepIndex.set(index);
    if (this.reducedMotion()) {
      this.clearTransient();
      return;
    }
    this.animatingIndex.set(index);
    const step = this._timeline()[index];
    if (step && step.kind === 'journal' && step.animation.primitive === 'compose-and-send') {
      this.runComposerTyping(step, index);
    } else {
      this.stopTyping();
    }
  }

  /** Virtual-clock gap to the next step (ms), compressed by speed. */
  private frameDelay(index: number): number {
    const timeline = this._timeline();
    if (index <= 0) {
      return MIN_FRAME_MS / this.speed();
    }
    const prev = timeline[index - 1]?.atMs ?? 0;
    const curr = timeline[index]?.atMs ?? prev;
    const gap = Math.abs(curr - prev);
    const clamped = Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, gap || MIN_FRAME_MS));
    return clamped / this.speed();
  }

  private runComposerTyping(
    step: Extract<Step, { kind: 'journal' }>,
    index: number
  ): void {
    this.stopTyping();
    const text = step.animation.typedText ?? step.entry.Text;
    const actor = this.run()
      ? attributionName(this.run()!, step.entry.FromID)
      : 'User';
    if (!text) {
      return;
    }
    const budget = Math.min(this.frameDelay(index) * 0.66, (text.length * 32) / this.speed());
    const start = performance.now();
    this.composerTyping.set({ chatId: step.chatId, actor, text, chars: 0 });

    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = budget <= 0 ? 1 : Math.min(1, elapsed / budget);
      const chars = Math.round(ratio * text.length);
      const current = this.composerTyping();
      if (!current) {
        return;
      }
      this.composerTyping.set({ ...current, chars });
      if (ratio < 1) {
        this.typingRaf = requestAnimationFrame(tick);
      } else {
        // Typed out: the composer clears and the bubble (already settled) lands.
        this.composerTyping.set(null);
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
    this.composerTyping.set(null);
  }

  private clearTimers(): void {
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
