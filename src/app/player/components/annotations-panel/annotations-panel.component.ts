import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { AnnotationPin, AnnotationThread, resolveAnchorMessageKey } from '../../engine/derive';
import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';

/**
 * Annotations: threaded comments anchored to conversation moments, authored
 * in-player (author name/email optional and never auto-filled) and exported
 * back to a `*.chatwright.json` entirely client-side. Dangling anchors/replies
 * render as such, never crash.
 */
@Component({
  selector: 'cw-annotations-panel',
  imports: [ButtonModule, InputTextModule, TextareaModule, TooltipModule],
  templateUrl: './annotations-panel.component.html',
  styleUrl: './annotations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationsPanelComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly draft = this.ui.draft;

  readonly totalCount = computed(() => this.engine.annotationPins().length);

  /** Threads shown, filtered to one message when a filter is active (item 4). */
  readonly threads = computed<AnnotationThread[]>(() => {
    const all = this.engine.annotationThreads();
    const filterKey = this.ui.annotationFilterKey();
    const run = this.engine.run();
    if (!filterKey || !run) {
      return all;
    }
    return all.filter(
      (thread) => resolveAnchorMessageKey(run, thread.root.annotation.anchor) === filterKey
    );
  });

  clearFilter(): void {
    this.ui.clearAnnotationFilter();
  }

  jump(pin: AnnotationPin): void {
    this.ui.focusAnnotation(pin.annotation.id);
    this.engine.seekTo(pin.stepIndex);
  }

  reply(pin: AnnotationPin): void {
    this.ui.startAnnotation(pin.annotation.anchor, pin.annotation.id);
  }

  submit(): void {
    this.ui.commitDraft();
  }

  cancel(): void {
    this.ui.cancelDraft();
  }

  updateName(event: Event): void {
    this.ui.updateDraft({ authorName: (event.target as HTMLInputElement).value });
  }

  updateEmail(event: Event): void {
    this.ui.updateDraft({ authorEmail: (event.target as HTMLInputElement).value });
  }

  updateText(event: Event): void {
    this.ui.updateDraft({ text: (event.target as HTMLTextAreaElement).value });
  }

  authorLabel(pin: AnnotationPin): string {
    const author = pin.annotation.author;
    if (!author) {
      return 'Anonymous';
    }
    return author.name || author.email || 'Anonymous';
  }

  /** Serialise the current (possibly annotated) bundle and download it. */
  exportBundle(): void {
    const bundle = this.engine.bundle();
    if (!bundle) {
      return;
    }
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const runId = this.engine.run()?.id ?? 'run';
    anchor.href = url;
    anchor.download = `${runId}.chatwright.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
