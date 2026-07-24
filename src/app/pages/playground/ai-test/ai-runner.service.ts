import { Injectable, signal } from '@angular/core';

import { executeRun, type AssertionOutcome, type ProgressSnapshot, type Run, type RunProgress, type RunResult } from '@chatwright/runtime';

export type AiRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

export interface AssertionLogEntry {
  readonly partId: string;
  readonly outcome: AssertionOutcome;
}

/**
 * Drives one `@chatwright/runtime` `executeRun` call and exposes its LIVE
 * progress as signals for the "AI test" panel: `ExecuteOptions.onProgress`/
 * `onAssertion` feed `progress()`/`loopSnapshot()`/`assertionLog()` as the
 * run happens, not only once it settles. Component-scoped (provided by
 * `AiTestPanelComponent`, not root) — a fresh instance per mount, one run at
 * a time.
 *
 * @remarks
 * Deliberately built from plain `signal`s only — no `effect()` — so it needs
 * no Angular injection context to construct: `new AiRunnerService()` works
 * directly in a unit test (see `ai-runner.service.spec.ts`), driving the
 * built-in greetbot scenario through a `ScriptedProvider`, zero network,
 * without pulling in `TestBed`.
 *
 * **`stop()` cannot abort an in-flight `executeRun` call directly** — the
 * engine exposes no cancellation hook of its own. Genuine early termination
 * instead goes through the `Provider`: the caller wraps its chosen provider
 * with `provider-source.ts`'s `withStopSignal(provider, () =>
 * runner.stopRequested())` before building the `Run`, so the very next
 * `propose()` call (the actor loop's own per-iteration seam) throws instead
 * of continuing — typically within one loop iteration of the visitor
 * pressing Stop, never mid-instant.
 */
@Injectable()
export class AiRunnerService {
  readonly status = signal<AiRunStatus>('idle');
  readonly stopRequested = signal(false);
  readonly progress = signal<RunProgress | null>(null);
  /**
   * The LAST ai-goal loop iteration's step/budget gauge — kept sticky across
   * a `'part-started'`/`'part-completed'` progress event (unlike `progress`
   * itself, which those events overwrite), so the run UI's step/budget meter
   * freezes at its final reading (e.g. "12/12 steps, stopped: true, reason:
   * goal-complete") rather than disappearing the instant the ai-goal part
   * finishes. `null` before any part has reported one (or for a purely
   * deterministic run, which never emits a `'loop'` progress event at all).
   */
  readonly loopSnapshot = signal<ProgressSnapshot | null>(null);
  readonly assertionLog = signal<readonly AssertionLogEntry[]>([]);
  readonly result = signal<RunResult | null>(null);
  readonly error = signal<string | null>(null);

  private runToken = 0;

  /**
   * Executes `run`, updating this service's signals as it happens.
   * Overlapping calls are safe: an older call's late-arriving callbacks are
   * dropped (a stale `runToken`) rather than clobbering a newer run's state.
   */
  async run(run: Run): Promise<void> {
    const token = ++this.runToken;
    this.stopRequested.set(false);
    this.status.set('running');
    this.progress.set(null);
    this.loopSnapshot.set(null);
    this.assertionLog.set([]);
    this.result.set(null);
    this.error.set(null);

    try {
      const result = await executeRun(run, {
        onProgress: (progress: RunProgress) => {
          if (token !== this.runToken) return;
          this.progress.set(progress);
          if (progress.kind === 'loop') this.loopSnapshot.set(progress.snapshot);
        },
        onAssertion: (partId: string, outcome: AssertionOutcome) => {
          if (token === this.runToken) this.assertionLog.update((log) => [...log, { partId, outcome }]);
        }
      });
      if (token !== this.runToken) return;
      this.result.set(result);
      const anyFailed = result.parts.some((part) => part.status === 'failed');
      this.status.set(anyFailed ? (this.stopRequested() ? 'stopped' : 'failed') : 'completed');
    } catch (err) {
      if (token !== this.runToken) return;
      this.error.set(err instanceof Error ? err.message : String(err));
      this.status.set(this.stopRequested() ? 'stopped' : 'failed');
    }
  }

  /** Requests cooperative cancellation — see this class's doc comment for what this can and cannot guarantee. */
  stop(): void {
    this.stopRequested.set(true);
  }

  /** Resets to a fresh, idle state — e.g. before configuring and starting a new run after a previous one finished. */
  reset(): void {
    this.runToken++;
    this.status.set('idle');
    this.stopRequested.set(false);
    this.progress.set(null);
    this.loopSnapshot.set(null);
    this.assertionLog.set([]);
    this.result.set(null);
    this.error.set(null);
  }
}
