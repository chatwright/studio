import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  untracked
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { Bundle } from './model/bundle.types';
import { PlayerEngine } from './player-engine';
import { PlayerUiState } from './player-ui';
import { TransportBarComponent } from './components/transport-bar/transport-bar.component';
import { TranscriptComponent } from './components/transcript/transcript.component';
import { NavPanelComponent } from './components/nav-panel/nav-panel.component';
import { ScenarioPanelComponent } from './components/scenario-panel/scenario-panel.component';
import { CastPanelComponent } from './components/cast-panel/cast-panel.component';
import { AnnotationsPanelComponent } from './components/annotations-panel/annotations-panel.component';
import { ProvenanceInspectorComponent } from './components/provenance-inspector/provenance-inspector.component';
import { SaveToSpaceComponent } from '../cloud/components/save-to-space/save-to-space.component';

/**
 * The self-contained, embeddable run-bundle player. It provides its own engine
 * and UI-state instances, so a landing-hero embed can drop several players on
 * one page without collision. It takes a parsed `bundle` input and owns
 * nothing about file loading — that is the route page's job.
 *
 * `embed` collapses the chrome (top bar, nav panel, right panel) to a
 * transcript-first compact layout for the landing-hero iframe
 * (?embed=1&sample=...&autoplay=1, see pages/player/player.page.ts and
 * player/embed-params.ts). `autoplay` starts playback as soon as a bundle
 * loads, unless the user prefers reduced motion — in which case playback
 * lands on the settled pre-roll state and the transport bar's own Play
 * button is used instead of animating unprompted.
 */
@Component({
  selector: 'cw-player',
  imports: [
    ButtonModule,
    TagModule,
    TooltipModule,
    TransportBarComponent,
    TranscriptComponent,
    NavPanelComponent,
    ScenarioPanelComponent,
    CastPanelComponent,
    AnnotationsPanelComponent,
    ProvenanceInspectorComponent,
    SaveToSpaceComponent
  ],
  providers: [PlayerEngine, PlayerUiState],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerComponent {
  readonly bundle = input<Bundle | null>(null);
  /**
   * The loaded bundle's exact source text — see
   * `SaveToSpaceComponent`/`RecordingsService.saveRecording`'s doc comments
   * on why "Save to my space" needs this rather than re-serialising
   * `bundle()`. For a locally dropped/picked/sample file this is the exact
   * on-disk bytes. For a cloud-loaded recording (`?cloud=` handoff, see
   * `player.page.ts`'s `loadFromCloud`) it is NOT null and NOT those exact
   * bytes either — it's `JSON.stringify(result.data.bundle)`, a re-serialised
   * copy of the parsed response, so re-saving a cloud-loaded recording
   * round-trips through parse+re-serialise rather than passing the server's
   * original bytes straight through (known limitation, not yet fixed).
   */
  readonly bundleText = input<string | null>(null);
  /** Suggested file name for the "download to disk instead" fallback in the sell-at-the-limit panel. */
  readonly sourceFileName = input<string | null>(null);
  readonly warnings = input<string[]>([]);
  readonly embed = input<boolean>(false);
  readonly autoplay = input<boolean>(false);

  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly downloadFileName = computed(() => this.sourceFileName() ?? `${this.engine.run()?.id || 'recording'}.chatwright.json`);

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

  /**
   * The bundle reference already handed to the engine. Guards against a
   * spurious re-run of the effect below re-loading (and thereby resetting
   * and, with autoplay, restarting) an already-playing run: `bundle()` is
   * still read unconditionally so the effect keeps tracking it, but
   * `engine.load()`/`engine.play()` only fire for a bundle we haven't
   * already loaded. Confirmed in production (chatwright.dev/studio/player
   * ?embed=1&autoplay=1&sample=...): with zoneless change detection, this
   * effect can re-run on the *same* `bundle` reference (Angular's scheduler
   * re-checking effects for reasons unrelated to `bundle` itself); without
   * this guard, every re-run called `engine.load()` again, which resets
   * stepIndex to -1 and re-armed `engine.play()`, so the run never advanced
   * past its pre-roll state — see player-engine.spec.ts.
   */
  private loadedBundle: Bundle | null = null;

  constructor() {
    // Feed the parsed bundle into the engine whenever the input changes.
    // `reducedMotion` is read via `untracked` so an OS-level reduced-motion
    // change mid-session (handled below) never re-triggers this effect and
    // reloads — and therefore restarts — whatever is currently playing.
    effect(() => {
      const bundle = this.bundle();
      if (bundle && bundle !== this.loadedBundle) {
        this.loadedBundle = bundle;
        this.engine.load(bundle, 0);
        if (this.autoplay() && !untracked(() => this.engine.reducedMotion())) {
          this.engine.play();
        }
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
