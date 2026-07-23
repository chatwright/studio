import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { Bundle } from '../../player/model/bundle.types';
import { parseBundleText } from '../../player/model/parse-bundle';
import { EmbedParams, parseEmbedParams } from '../../player/embed-params';
import { PlayerComponent } from '../../player/player.component';
import { BUNDLED_SAMPLES, BundledSample } from '../../player/samples';

/**
 * The /player route: the front door for no-upload local playback. A
 * `*.chatwright.json` is dragged onto the page (or chosen with the file
 * picker) and plays entirely client-side — the bundle content never leaves the
 * machine and makes zero network round-trips. "Load sample" fetches a
 * same-origin demo fixture as a convenience; drag-and-drop stays primary.
 *
 * This is also the landing-hero embed target: `?embed=1&sample=<file>
 * &autoplay=1` (see player/embed-params.ts) autoloads a BUNDLED_SAMPLES entry
 * and hides the page heading, handing the compact layout over to
 * `<cw-player [embed]="true">`. Drag-and-drop of the visitor's *own* files
 * keeps working unchanged in embed mode — the (dragover)/(drop) bindings stay
 * on this same outer <section> regardless of embed state.
 */
@Component({
  selector: 'cw-player-page',
  imports: [ButtonModule, TooltipModule, PlayerComponent],
  templateUrl: './player.page.html',
  styleUrl: './player.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerPage {
  readonly bundle = signal<Bundle | null>(null);
  readonly warnings = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly dragOver = signal(false);
  readonly loadingSampleFile = signal<string | null>(null);

  readonly samples: BundledSample[] = BUNDLED_SAMPLES;

  private readonly route = inject(ActivatedRoute);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });
  readonly embedParams = computed<EmbedParams>(() => parseEmbedParams(this.queryParamMap()));
  readonly embed = computed(() => this.embedParams().embed);
  readonly autoplay = computed(() => this.embedParams().autoplay);

  /** De-dupes autoload against unrelated signal changes — see the effect
   *  below — without reactively depending on `fileName`/`bundle`, which would
   *  otherwise fight a visitor's own manual drop of a different file. */
  private lastAutoSample: string | null = null;

  constructor() {
    effect(() => {
      const params = this.embedParams();
      if (!params.embed || !params.sample || params.sample === this.lastAutoSample) {
        return;
      }
      const match = this.samples.find((sample) => sample.file === params.sample);
      if (match) {
        this.lastAutoSample = params.sample;
        void this.loadSample(match);
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.readFile(file);
    }
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.readFile(file);
    }
    input.value = '';
  }

  async loadSample(sample: BundledSample): Promise<void> {
    this.loadingSampleFile.set(sample.file);
    this.error.set(null);
    try {
      const url = new URL(`samples/${sample.file}`, document.baseURI).href;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`sample not found (${response.status})`);
      }
      const text = await response.text();
      this.applyText(text, sample.file);
    } catch (error) {
      this.error.set(
        `Could not load "${sample.title}" — ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.loadingSampleFile.set(null);
    }
  }

  clear(): void {
    this.bundle.set(null);
    this.warnings.set([]);
    this.error.set(null);
    this.fileName.set(null);
  }

  private async readFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      this.applyText(text, file.name);
    } catch (error) {
      this.error.set(
        `Could not read that file — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private applyText(text: string, name: string): void {
    const result = parseBundleText(text);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    this.fileName.set(name);
    this.warnings.set(result.warnings);
    this.bundle.set(result.bundle);
  }
}
