import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { Bundle } from '../../player/model/bundle.types';
import { parseBundleText } from '../../player/model/parse-bundle';
import { PlayerComponent } from '../../player/player.component';

/**
 * The /player route: the front door for no-upload local playback. A
 * `*.chatwright.json` is dragged onto the page (or chosen with the file
 * picker) and plays entirely client-side — the bundle content never leaves the
 * machine and makes zero network round-trips. "Load sample" fetches a
 * same-origin demo fixture as a convenience; drag-and-drop stays primary.
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
  readonly loadingSample = signal(false);

  private readonly sampleUrl = new URL(
    'samples/greetbot-language.chatwright.json',
    document.baseURI
  ).href;

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

  async loadSample(): Promise<void> {
    this.loadingSample.set(true);
    this.error.set(null);
    try {
      const response = await fetch(this.sampleUrl);
      if (!response.ok) {
        throw new Error(`sample not found (${response.status})`);
      }
      const text = await response.text();
      this.applyText(text, 'greetbot-language.chatwright.json');
    } catch (error) {
      this.error.set(
        `Could not load the sample bundle — ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.loadingSample.set(false);
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
