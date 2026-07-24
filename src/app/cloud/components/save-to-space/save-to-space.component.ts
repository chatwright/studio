import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../auth.service';
import { RecordingsService } from '../../recordings.service';
import { LimitReachedBody, QuotaMetadata } from '../../recordings.types';
import { QuotaPanelComponent } from '../quota-panel/quota-panel.component';

/**
 * The Player's "Save to my space" action (spec: Studio account block PR,
 * "Player" scope item). Thin by design — all request/response handling
 * lives in `RecordingsService`; this component only turns its
 * `RecordingsResult` into the three states a visitor can see: saving,
 * saved (with the quiet quota counter), or at-limit (the sell-at-the-limit
 * panel, `QuotaPanelComponent`). "Download to disk" — the free local
 * fallback the limit panel always offers alongside the upgrade link — is
 * handled right here since this component already holds the bundle text.
 */
@Component({
  selector: 'cw-save-to-space',
  imports: [TooltipModule, QuotaPanelComponent],
  templateUrl: './save-to-space.component.html',
  styleUrl: './save-to-space.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveToSpaceComponent {
  /** The exact bytes of the currently loaded `*.chatwright.json` — see `RecordingsService.saveRecording`'s doc comment on why this is raw text, not a re-serialised object. */
  readonly bundleText = input<string | null>(null);
  /** Suggested file name for the "download to disk instead" fallback. */
  readonly fileName = input<string>('recording.chatwright.json');

  readonly auth = inject(AuthService);
  private readonly recordings = inject(RecordingsService);

  readonly saving = signal(false);
  readonly quota = signal<QuotaMetadata | null>(null);
  readonly limitReached = signal<LimitReachedBody | null>(null);
  readonly savedTitle = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly tooltip = computed(() =>
    this.auth.signedIn() ? undefined : 'Sign in to save this recording to your Sneat account'
  );

  async onSaveClick(): Promise<void> {
    if (this.saving() || !this.auth.signedIn()) {
      return;
    }
    const text = this.bundleText();
    if (!text) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.limitReached.set(null);
    this.savedTitle.set(null);

    const result = await this.recordings.saveRecording(text);
    this.saving.set(false);

    if (result.ok) {
      this.quota.set(result.data.quota ?? null);
      this.savedTitle.set(result.data.recording.title);
      return;
    }

    switch (result.kind) {
      case 'limit_reached':
        this.limitReached.set(result.body);
        break;
      case 'unauthenticated':
        this.error.set('Your session expired — sign in again to save.');
        break;
      case 'unknown_space':
        this.error.set('Could not resolve your personal space — please try again.');
        break;
      case 'error':
        this.error.set(result.message);
        break;
    }
  }

  /** The sell-at-the-limit panel's always-offered free local path — never gated, works even signed out. */
  downloadToDisk(): void {
    const text = this.bundleText();
    if (!text || typeof document === 'undefined') {
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
