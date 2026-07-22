import { Injectable, computed, inject, signal } from '@angular/core';

import { BundleAnchor, BundleAnnotation, BundleRun } from './model/bundle.types';
import {
  MessageLineage,
  loopEventForBotMessage,
  messageLineage
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

/**
 * Player UI state shared across the transcript, inspector, mind panel and
 * annotation authoring — kept out of the engine (which owns playback) and out
 * of any one component (so the whole player stays embeddable). Provided at the
 * PlayerComponent level, so every embed gets its own instance.
 */
@Injectable()
export class PlayerUiState {
  private readonly engine = inject(PlayerEngine);

  readonly inspector = signal<InspectorTarget | null>(null);
  readonly draft = signal<AnnotationDraft | null>(null);
  readonly castOpen = signal(true);
  readonly mindOpen = signal(true);
  readonly focusedAnnotationId = signal<string | null>(null);

  focusAnnotation(id: string | null): void {
    this.focusedAnnotationId.set(id);
  }

  readonly lineage = computed<MessageLineage | null>(() => {
    const target = this.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return null;
    }
    return messageLineage(run, target.chatId, target.messageId);
  });

  /** If the inspected message is a bot message inside an ai-goal part, the
   *  loop event that observed it (for the transcript↔reasoning jump). */
  readonly inspectorLoopLink = computed(() => {
    const target = this.inspector();
    const run = this.engine.run();
    if (!target || !run) {
      return null;
    }
    return loopEventForBotMessage(run, target.chatId, target.messageId);
  });

  inspectMessage(chatId: number, messageId: number, actionId?: string): void {
    this.inspector.set({ chatId, messageId, actionId });
  }

  closeInspector(): void {
    this.inspector.set(null);
  }

  toggleCast(): void {
    this.castOpen.update((v) => !v);
  }

  toggleMind(): void {
    this.mindOpen.update((v) => !v);
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
