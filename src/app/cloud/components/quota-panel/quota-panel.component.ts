import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { formatQuotaCounter } from '../../format';
import { LimitReachedBody, QuotaMetadata } from '../../recordings.types';

/**
 * Renders Chatwright Cloud's sell-at-the-limit wire contract
 * (chatwright/cloud README.md, "Wire contract" + "Boundary rules"):
 *
 * - `quota` set, `limitReached` unset → the quiet counter only ("Saved 2 of
 *   10 free recordings").
 * - `limitReached` set → the upgrade gate, which per the founder's
 *   non-negotiable boundary rule ALWAYS pairs the `upgradeUrl` link with a
 *   free, unlimited local-download offer in the same breath — this
 *   component never renders one without the other. The actual download is
 *   the caller's job (`downloadRequested` output): this component has no
 *   bundle bytes of its own to save, only the surrounding UI.
 *
 * Shared between the Player's "Save to my space" action and (potentially)
 * any other quota-gated surface, so the sell-at-the-limit pattern renders
 * identically everywhere it appears.
 */
@Component({
  selector: 'cw-quota-panel',
  imports: [ButtonModule],
  templateUrl: './quota-panel.component.html',
  styleUrl: './quota-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuotaPanelComponent {
  readonly quota = input<QuotaMetadata | null>(null);
  readonly limitReached = input<LimitReachedBody | null>(null);
  readonly downloadRequested = output<void>();

  readonly counterText = computed(() => formatQuotaCounter(this.quota()));

  readonly limitMessage = computed(() => {
    const limit = this.limitReached();
    if (!limit) {
      return null;
    }
    return `You've saved ${limit.used} of ${limit.limit} recordings on the ${limit.plan} plan — that's the limit.`;
  });
}
