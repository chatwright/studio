import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../cloud/auth.service';
import { formatBytes, formatQuotaCounter, formatRecordingDate } from '../../cloud/format';
import { RecordingsService } from '../../cloud/recordings.service';
import { QuotaMetadata, RecordingSummary } from '../../cloud/recordings.types';

/**
 * `/recordings` — "My recordings": lists what the signed-in Sneat account has
 * saved to their personal space via the Player's "Save to my space" action,
 * and hands a click off to `/player?cloud=<id>&spaceID=<spaceID>` to replay
 * it (see `pages/player/player.page.ts`'s matching `?cloud=` handoff).
 *
 * Four states, checked in this order in the template: signed out → a sign-in
 * prompt; loading → a spinner; a known personal space with zero recordings
 * OR no known space yet → two distinct empty states (see
 * `RecordingsService`'s doc comment on the personal-space-id gap — this page
 * is exactly where that gap surfaces to a visitor, so it explains rather
 * than shows a bare "nothing here"); otherwise the list.
 */
@Component({
  selector: 'cw-recordings-page',
  imports: [ButtonModule, TooltipModule, RouterLink],
  templateUrl: './recordings.page.html',
  styleUrl: './recordings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordingsPage {
  readonly auth = inject(AuthService);
  private readonly recordings = inject(RecordingsService);
  private readonly router = inject(Router);

  readonly items = signal<RecordingSummary[]>([]);
  readonly quota = signal<QuotaMetadata | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  /** `null` once loaded means "no personal space known yet" — the dedicated empty state, not just "zero recordings". */
  readonly hasKnownSpace = computed(() => this.recordings.spaceID() !== null);
  readonly quotaText = computed(() => formatQuotaCounter(this.quota()));

  readonly formatBytes = formatBytes;
  readonly formatDate = formatRecordingDate;

  constructor() {
    // Auto-(re)loads whenever sign-in state settles or changes — covers the
    // common case of landing on this route already signed in, and the
    // sign-in-from-the-sidebar-while-on-this-page case.
    effect(() => {
      if (this.auth.initializing()) {
        return;
      }
      if (!this.auth.signedIn()) {
        this.items.set([]);
        this.loaded.set(false);
        return;
      }
      void this.refresh();
    });
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const result = await this.recordings.listRecordings();
    this.loading.set(false);
    this.loaded.set(true);

    if (!result.ok) {
      // 'unknown_space' and 'unauthenticated' both render as an empty/prompt
      // state in the template (via hasKnownSpace()/auth.signedIn()), not an
      // error banner — only a genuine request failure does.
      if (result.kind === 'error') {
        this.error.set(result.message);
      }
      this.items.set([]);
      return;
    }

    this.items.set(result.data.recordings);
    this.quota.set(result.data.quota ?? null);
  }

  open(recording: RecordingSummary): void {
    const spaceID = this.recordings.knownSpaceID();
    if (!spaceID) {
      return;
    }
    void this.router.navigate(['/player'], { queryParams: { cloud: recording.id, spaceID } });
  }
}
