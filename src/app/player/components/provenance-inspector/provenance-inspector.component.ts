import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { messageKey } from '../../engine/animation';
import { AnnotationThread, ObservedByRow, resolveAnchorMessageKey } from '../../engine/derive';
import { PlatformJournalEntry } from '../../model/bundle.types';
import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';
import { RawJsonComponent } from '../raw-json/raw-json.component';

/**
 * Click-to-provenance inspector: the message↔lineage↔AI-reasoning link as a
 * first-class surface. For any clicked message it shows the original entry,
 * every edit and the resulting version; for an inline button, the callback that
 * fired and the bot response; its "Observed by" section names each ai-goal part
 * that observed the message and what the actor proposed next, each row a jump
 * that lands the timeline on that loop event with the Scenario tab open and the
 * row highlighted; and it lists the message's own annotations.
 */
@Component({
  selector: 'cw-provenance-inspector',
  imports: [ButtonModule, TagModule, TooltipModule, RawJsonComponent],
  templateUrl: './provenance-inspector.component.html',
  styleUrl: './provenance-inspector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProvenanceInspectorComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly target = this.ui.inspector;
  readonly lineage = this.ui.lineage;
  readonly observedBy = this.ui.observedBy;

  /** The raw journal entries backing the inspected message — every version
   *  plus any action targeting it — verbatim from the loaded bundle. */
  readonly rawEntries = computed<PlatformJournalEntry[]>(() => {
    const target = this.ui.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return [];
    }
    const entries = run.chats?.find((c) => c.chatId === target.chatId)?.entries ?? [];
    return entries.filter(
      (e) =>
        e.MessageID === target.messageId ||
        (e.Kind === 'action' && e.RefMessageID === target.messageId)
    );
  });

  /** The action press the inspector opened from, if any. */
  readonly focusedPress = computed(() => {
    const target = this.ui.inspector();
    const lineage = this.ui.lineage();
    if (!target?.actionId || !lineage) {
      return null;
    }
    return lineage.presses.find((press) => press.actionId === target.actionId) ?? null;
  });

  /** Annotation threads anchored to the inspected message (item 4). */
  readonly messageThreads = computed<AnnotationThread[]>(() => {
    const target = this.ui.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return [];
    }
    const key = messageKey(target.chatId, target.messageId);
    return this.engine
      .annotationThreads()
      .filter((thread) => resolveAnchorMessageKey(run, thread.root.annotation.anchor) === key);
  });

  jumpToObservation(row: ObservedByRow): void {
    this.engine.seekToEvent(row.partIndex, row.eventIndex);
    this.ui.showScenarioEvent(row.partIndex, row.eventIndex);
  }

  addComment(): void {
    const target = this.ui.inspector();
    if (target) {
      this.ui.startAnnotation({ chatId: target.chatId, entryIndex: 0, messageId: target.messageId });
    }
  }

  showAllAnnotations(): void {
    const target = this.ui.inspector();
    if (target) {
      this.ui.showAnnotationsFor(messageKey(target.chatId, target.messageId));
    }
  }

  authorLabel(thread: AnnotationThread): string {
    const author = thread.root.annotation.author;
    return author?.name || author?.email || 'Anonymous';
  }

  close(): void {
    this.ui.closeInspector();
  }
}
