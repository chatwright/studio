import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A collapsible, read-only "Raw source (JSON)" viewer with a copy button.
 * Renders the pretty-printed JSON of whatever value it is given, verbatim from
 * the loaded bundle (JSON.parse preserves source key order, so what is shown
 * matches the file). The honesty is the point: it proves the player's animation
 * layer invents nothing — the transcript and mind panel are views over exactly
 * this data.
 */
@Component({
  selector: 'cw-raw-json',
  imports: [],
  templateUrl: './raw-json.component.html',
  styleUrl: './raw-json.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RawJsonComponent {
  readonly value = input<unknown>(null);
  readonly label = input<string>('Raw source (JSON)');

  readonly open = signal(false);
  readonly copied = signal(false);

  readonly json = computed(() => {
    try {
      return JSON.stringify(this.value(), null, 2);
    } catch {
      return '/* value is not serialisable */';
    }
  });

  toggle(): void {
    this.open.update((v) => !v);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.json());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1400);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); fail silently.
    }
  }
}
