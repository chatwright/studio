import { Injectable, computed, inject, signal } from '@angular/core';

import { BundleAnchor, BundleAnnotation, BundleRun } from './model/bundle.types';
import {
  MessageLineage,
  ObservedByRow,
  messageLineage,
  observedByParts
} from './engine/derive';
import { PlayerEngine } from './player-engine';

/** What the provenance inspector is currently focused on. */
export interface InspectorTarget {
  chatId: number;
  messageId: number;
  /** When set, the inspector opened from a specific action press. */
  actionId?: string;
}

/** Draft state for authoring an annotation or reply in-player. */
export interface AnnotationDraft {
  anchor: BundleAnchor;
  replyTo?: string;
  authorName: string;
  authorEmail: string;
  text: string;
}

/** Which tab the right panel shows. */
export type RightTab = 'scenario' | 'annotations' | 'cast';

/** A part+event the Scenario tab should expand, scroll to and highlight. */
export interface ScenarioFocus {
  partIndex: number;
  eventIndex: number;
}

/**
 * Player UI state shared across the transcript, inspector, right-panel tabs and
 * annotation authoring — kept out of the engine (which owns playback) and out
 * of any one component (so the whole player stays embeddable). Provided at the
 * PlayerComponent level, so every embed gets its own instance.
 */
@Injectable()
export class PlayerUiState {
  private readonly engine = inject(PlayerEngine);

  readonly inspector = signal<InspectorTarget | null>(null);
  readonly draft = signal<AnnotationDraft | null>(null);

  /** Left navigation panel and right tabbed panel collapse state. */
  readonly navOpen = signal(true);
  readonly rightOpen = signal(true);
  readonly rightTab = signal<RightTab>('scenario');

  readonly focusedAnnotationId = signal<string | null>(null);
  /** When set, the Annotations tab shows only comments on this message key. */
  readonly annotationFilterKey = signal<string | null>(null);
  /** When set, the Scenario tab expands + highlights this loop event. */
  readonly scenarioFocus = signal<ScenarioFocus | null>(null);

  readonly lineage = computed<MessageLineage | null>(() => {
    const target = this.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return null;
    }
    return messageLineage(run, target.chatId, target.messageId);
  });

  /** Every ai-goal part whose retained observations include the inspected
   *  message, with what the actor proposed next — the "Observed by" section. */
  readonly observedBy = computed<ObservedByRow[]>(() => {
    const target = this.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return [];
    }
    return observedByParts(run, target.chatId, target.messageId);
  });

  /* --------------------------------------------------- panel controls */

  toggleNav(): void {
    this.navOpen.update((v) => !v);
  }

  toggleRight(): void {
    this.rightOpen.update((v) => !v);
  }

  showTab(tab: RightTab): void {
    this.rightTab.set(tab);
    this.rightOpen.set(true);
  }

  focusAnnotation(id: string | null): void {
    this.focusedAnnotationId.set(id);
  }

  /** Reveal a message's annotations in the Annotations tab (item 4). */
  showAnnotationsFor(messageKey: string, focusId?: string): void {
    this.annotationFilterKey.set(messageKey);
    this.focusedAnnotationId.set(focusId ?? null);
    this.showTab('annotations');
  }

  clearAnnotationFilter(): void {
    this.annotationFilterKey.set(null);
  }

  /** Reveal a loop event in the Scenario tab (item 5 "Observed by" landing). */
  showScenarioEvent(partIndex: number, eventIndex: number): void {
    this.scenarioFocus.set({ partIndex, eventIndex });
    this.showTab('scenario');
  }

  /* ---------------------------------------------------------- inspector */

  inspectMessage(chatId: number, messageId: number, actionId?: string): void {
    this.inspector.set({ chatId, messageId, actionId });
  }

  closeInspector(): void {
    this.inspector.set(null);
  }

  /* --------------------------------------------------- annotations */

  startAnnotation(anchor: BundleAnchor, replyTo?: string): void {
    this.draft.set({
      anchor,
      replyTo,
      authorName: '',
      authorEmail: '',
      text: ''
    });
    this.showTab('annotations');
  }

  updateDraft(patch: Partial<AnnotationDraft>): void {
    const current = this.draft();
    if (current) {
      this.draft.set({ ...current, ...patch });
    }
  }

  cancelDraft(): void {
    this.draft.set(null);
  }

  /** Commit the draft into the current run's annotations (in memory). */
  commitDraft(now: Date = new Date()): BundleAnnotation | null {
    const draft = this.draft();
    const run = this.engine.run();
    if (!draft || !run || draft.text.trim().length === 0) {
      return null;
    }
    const annotation: BundleAnnotation = {
      id: newAnnotationId(),
      anchor: draft.anchor,
      createdAt: now.toISOString(),
      text: draft.text.trim()
    };
    if (draft.authorName.trim() || draft.authorEmail.trim()) {
      annotation.author = {};
      if (draft.authorName.trim()) {
        annotation.author.name = draft.authorName.trim();
      }
      if (draft.authorEmail.trim()) {
        annotation.author.email = draft.authorEmail.trim();
      }
    }
    if (draft.replyTo) {
      annotation.replyTo = draft.replyTo;
    }

    const next: BundleRun = {
      ...run,
      annotations: [...(run.annotations ?? []), annotation]
    };
    this.engine.patchRun(next);
    this.draft.set(null);
    return annotation;
  }
}

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `note-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `note-${Date.now().toString(36)}`;
}
