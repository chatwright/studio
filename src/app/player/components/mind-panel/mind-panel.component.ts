import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { findingSeverity } from '../../engine/derive';
import { ActorLoopEvent, BundlePart } from '../../model/bundle.types';
import { PlayerEngine } from '../../player-engine';

/**
 * The AI mind panel: for an ai-goal part, one card per loop event showing what
 * the actor observed, its proposal + rationale, the validation verdict, the
 * action outcome and token/latency usage — synchronised to playback via the
 * engine's AI cursor. Deterministic and unknown-kind parts get no mind panel
 * (they are transcript-only chapters).
 */
@Component({
  selector: 'cw-mind-panel',
  imports: [TagModule, TooltipModule],
  templateUrl: './mind-panel.component.html',
  styleUrl: './mind-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MindPanelComponent {
  readonly engine = inject(PlayerEngine);

  readonly activePart = computed<BundlePart | null>(() => {
    const run = this.engine.run();
    const partIndex = this.engine.aiCursor().activePartIndex;
    return run?.parts?.[partIndex] ?? null;
  });

  readonly isAiPart = computed(() => this.activePart()?.kind === 'ai-goal' && !!this.activePart()?.aiGoal);

  readonly events = computed<ActorLoopEvent[]>(() => this.activePart()?.aiGoal?.events ?? []);

  readonly revealed = computed(() => new Set(this.engine.aiCursor().revealedEventIndexes));
  readonly activeEventIndex = computed(() => this.engine.aiCursor().activeEventIndex);
  readonly activeBeat = computed(() => this.engine.aiCursor().activeBeat);

  readonly report = computed(() => this.activePart()?.aiGoal?.report ?? null);
  readonly goal = computed(() => this.activePart()?.aiGoal?.goal ?? null);
  readonly evidence = computed(() => this.activePart()?.aiGoal?.evidence ?? []);

  isRevealed(index: number): boolean {
    return this.revealed().has(index);
  }

  isActive(index: number): boolean {
    return this.activeEventIndex() === index;
  }

  proposalLabel(event: ActorLoopEvent): string {
    switch (event.Proposal.Kind) {
      case 'send-text':
        return `Send: "${event.Proposal.Text}"`;
      case 'click':
        return `Click: ${event.Proposal.ActionID}`;
      case 'task-done':
        return 'Mark task done';
      case 'give-up':
        return 'Give up';
      default:
        return event.Proposal.Kind;
    }
  }

  proposalSeverity(event: ActorLoopEvent): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (event.Proposal.Kind) {
      case 'task-done':
        return 'success';
      case 'give-up':
        return 'danger';
      case 'click':
        return 'info';
      default:
        return 'secondary';
    }
  }

  outcomeSeverity(kind: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (kind) {
      case 'executed':
      case 'task-completed':
        return 'success';
      case 'executed-no-effect':
        return 'info';
      case 'skipped-invalid':
      case 'resolution-failed':
      case 'task-given-up':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  verdictSeverity(verdict: string): 'success' | 'warn' | 'secondary' {
    if (verdict === 'fresh') return 'success';
    if (verdict === 'stale') return 'warn';
    return 'secondary';
  }

  latencyMs(nanoseconds: number): string {
    if (!nanoseconds) return '0';
    return (nanoseconds / 1e6).toFixed(nanoseconds < 1e6 ? 2 : 0);
  }

  findingSeverity(kind: string): string {
    return findingSeverity(kind);
  }
}
