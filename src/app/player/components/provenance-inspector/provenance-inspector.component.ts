import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';

/**
 * Click-to-provenance inspector: the message↔lineage↔AI-reasoning link as a
 * first-class surface (not a debug view). For any clicked message it shows the
 * original entry, every edit, and the resulting version; for an inline button,
 * the callback that fired and the bot response; and for a bot message inside an
 * ai-goal part, a jump to the loop event that observed it.
 */
@Component({
  selector: 'cw-provenance-inspector',
  imports: [ButtonModule, TagModule],
  templateUrl: './provenance-inspector.component.html',
  styleUrl: './provenance-inspector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProvenanceInspectorComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly target = this.ui.inspector;
  readonly lineage = this.ui.lineage;
  readonly loopLink = this.ui.inspectorLoopLink;

  /** The action press the inspector opened from, if any. */
  readonly focusedPress = computed(() => {
    const target = this.ui.inspector();
    const lineage = this.ui.lineage();
    if (!target?.actionId || !lineage) {
      return null;
    }
    return lineage.presses.find((press) => press.actionId === target.actionId) ?? null;
  });

  jumpToReasoning(): void {
    const link = this.loopLink();
    if (link) {
      this.engine.seekToEvent(link.partIndex, link.eventIndex);
    }
  }

  close(): void {
    this.ui.closeInspector();
  }
}
