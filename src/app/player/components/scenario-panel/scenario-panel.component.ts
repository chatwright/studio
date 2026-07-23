import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { ActorLoopEvent, BundlePart } from '../../model/bundle.types';
import { findingSeverity } from '../../engine/derive';
import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';
import { RawJsonComponent } from '../raw-json/raw-json.component';

interface PartCard {
  index: number;
  part: BundlePart;
  title: string;
  isAi: boolean;
  entryCount: number;
}

/**
 * Scenario tab (default): a card per part — deterministic and ai-goal. Each
 * card header is the goal title (ai-goal) or part title; inside, full-width
 * line-separated accordion sections (never nested cards). Synchronised to the
 * playhead (the active part and loop event are highlighted) and responsive to
 * the inspector's "Observed by" jumps via ui.scenarioFocus.
 */
@Component({
  selector: 'cw-scenario-panel',
  imports: [TagModule, TooltipModule, RawJsonComponent],
  templateUrl: './scenario-panel.component.html',
  styleUrl: './scenario-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioPanelComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly overrides = signal<Map<string, boolean>>(new Map());

  readonly cards = computed<PartCard[]>(() => {
    const run = this.engine.run();
    return (run?.parts ?? []).map((part, index) => {
      const isAi = part.kind === 'ai-goal' && !!part.aiGoal;
      const entryCount = (part.journalBoundary?.chats ?? []).reduce(
        (sum, b) => sum + b.entryCount,
        0
      );
      return {
        index,
        part,
        title: isAi ? part.aiGoal!.goal?.Title || part.title || part.id : part.title || part.id,
        isAi,
        entryCount
      };
    });
  });

  readonly activePartIndex = computed(() => this.engine.aiCursor().activePartIndex);
  readonly activeEventIndex = computed(() => this.engine.aiCursor().activeEventIndex);

  constructor() {
    // When the inspector jumps here, expand the target part's Loop section and
    // scroll it into view; the playhead lands on the event, so the active-event
    // highlight is already in place.
    effect(() => {
      const focus = this.ui.scenarioFocus();
      if (!focus) {
        return;
      }
      this.setOpen(`${focus.partIndex}:loop`, true);
      requestAnimationFrame(() => {
        const el = this.host.nativeElement.querySelector(
          `#scn-event-${focus.partIndex}-${focus.eventIndex}`
        );
        el?.scrollIntoView({ behavior: this.engine.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
    });
  }

  isPartActive(index: number): boolean {
    return this.activePartIndex() === index;
  }

  defaultOpen(partIndex: number, section: string): boolean {
    if (section !== 'loop') {
      return false;
    }
    const focus = this.ui.scenarioFocus();
    return this.isPartActive(partIndex) || focus?.partIndex === partIndex;
  }

  isOpen(partIndex: number, section: string): boolean {
    const override = this.overrides().get(`${partIndex}:${section}`);
    return override ?? this.defaultOpen(partIndex, section);
  }

  toggle(partIndex: number, section: string): void {
    this.setOpen(`${partIndex}:${section}`, !this.isOpen(partIndex, section));
  }

  private setOpen(key: string, value: boolean): void {
    const next = new Map(this.overrides());
    next.set(key, value);
    this.overrides.set(next);
  }

  isEventActive(partIndex: number, eventIndex: number): boolean {
    return this.isPartActive(partIndex) && this.activeEventIndex() === eventIndex;
  }

  isEventFocused(partIndex: number, eventIndex: number): boolean {
    const focus = this.ui.scenarioFocus();
    return focus?.partIndex === partIndex && focus?.eventIndex === eventIndex;
  }

  /* --- event formatting (shared vocabulary with the derive layer) --- */

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
