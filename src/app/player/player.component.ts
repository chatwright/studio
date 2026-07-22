import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { Bundle } from './model/bundle.types';
import { PlayerEngine } from './player-engine';
import { PlayerUiState } from './player-ui';
import { TransportBarComponent } from './components/transport-bar/transport-bar.component';
import { TranscriptComponent } from './components/transcript/transcript.component';
import { MindPanelComponent } from './components/mind-panel/mind-panel.component';
import { CastPanelComponent } from './components/cast-panel/cast-panel.component';
import { AnnotationsPanelComponent } from './components/annotations-panel/annotations-panel.component';
import { ProvenanceInspectorComponent } from './components/provenance-inspector/provenance-inspector.component';

/**
 * The self-contained, embeddable run-bundle player. It provides its own engine
 * and UI-state instances, so a landing-hero embed (planned follow-up) can drop
 * several players on one page without collision. It takes a parsed `bundle`
 * input and owns nothing about file loading — that is the route page's job.
 */
@Component({
  selector: 'cw-player',
  imports: [
    ButtonModule,
    TagModule,
    TooltipModule,
    TransportBarComponent,
    TranscriptComponent,
    MindPanelComponent,
    CastPanelComponent,
    AnnotationsPanelComponent,
    ProvenanceInspectorComponent
  ],
  providers: [PlayerEngine, PlayerUiState],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerComponent {
  readonly bundle = input<Bundle | null>(null);
  readonly warnings = input<string[]>([]);

  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly runs = computed(() => this.engine.bundle()?.runs ?? []);
  readonly metadata = computed(() => this.engine.bundle()?.metadata ?? null);

  readonly createdAtLabel = computed(() => {
    const raw = this.metadata()?.createdAt;
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime())
      ? raw
      : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  });

  readonly authorLabel = computed(() => {
    const author = this.metadata()?.author;
    if (!author) {
      return '';
    }
    return author.name || author.email || '';
  });

  constructor() {
    // Feed the parsed bundle into the engine whenever the input changes.
    effect(() => {
      const bundle = this.bundle();
      if (bundle) {
        this.engine.load(bundle, 0);
      }
    });

    // Respect prefers-reduced-motion with an instant-state fallback, and keep
    // it live if the user flips the OS setting mid-session.
    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-reduced-motion: reduce)');
      this.engine.setReducedMotion(query.matches);
      query.addEventListener('change', (event) => this.engine.setReducedMotion(event.matches));
    }
  }

  selectRun(index: number): void {
    this.engine.selectRun(index);
    this.ui.closeInspector();
  }

  toggleReducedMotion(): void {
    this.engine.setReducedMotion(!this.engine.reducedMotion());
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('input, textarea')) {
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      this.engine.toggle();
    } else if (event.key === 'ArrowRight' && !event.repeat) {
      // Arrow stepping is also handled by the focused scrubber; guard here for
      // when focus is elsewhere on the player.
      if (!target?.closest('.scrubber')) {
        event.preventDefault();
        this.engine.next();
      }
    } else if (event.key === 'ArrowLeft' && !event.repeat) {
      if (!target?.closest('.scrubber')) {
        event.preventDefault();
        this.engine.prev();
      }
    } else if (event.key === 'Escape' && this.ui.inspector()) {
      this.ui.closeInspector();
    }
  }
}
