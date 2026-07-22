import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { Marker } from '../../engine/derive';
import { PlayerEngine, SPEED_STOPS, Speed } from '../../player-engine';

/**
 * Transport controls: play/pause, discrete prev/next stepping, a speed control
 * with preset stops, and a timeline scrubber whose chapters are the run's
 * parts and whose ticks are derived markers + bookmarks. Every control drives
 * the engine; the scrubber lands on settled state instantly (no animation
 * wait) because seekTo clears transient animation state.
 */
@Component({
  selector: 'cw-transport-bar',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './transport-bar.component.html',
  styleUrl: './transport-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransportBarComponent {
  readonly engine = inject(PlayerEngine);
  readonly speeds = SPEED_STOPS;
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private dragging = false;

  readonly last = computed(() => Math.max(1, this.engine.lastIndex()));

  readonly chapterSegments = computed(() => {
    const last = this.engine.lastIndex();
    const span = last <= 0 ? 1 : last;
    return this.engine.chapters().map((chapter, i) => ({
      chapter,
      left: (chapter.startIndex / span) * 100,
      width: ((chapter.endIndex - chapter.startIndex) / span) * 100,
      even: i % 2 === 0
    }));
  });

  readonly markerTicks = computed(() => {
    const last = this.engine.lastIndex();
    const span = last <= 0 ? 1 : last;
    return this.engine.markers().map((marker) => ({
      marker,
      left: (Math.max(0, marker.stepIndex) / span) * 100
    }));
  });

  readonly progressPercent = computed(() => this.engine.progress() * 100);

  readonly positionLabel = computed(() => {
    const i = this.engine.stepIndex();
    const total = this.engine.stepCount();
    return `${Math.max(0, i + 1)} / ${total}`;
  });

  readonly currentChapterTitle = computed(() => {
    const step = this.engine.currentStep();
    return step ? step.partTitle : 'Ready';
  });

  setSpeed(speed: Speed): void {
    this.engine.setSpeed(speed);
  }

  jumpToMarker(marker: Marker, domEvent: Event): void {
    domEvent.stopPropagation();
    this.engine.jumpToMarker(marker);
  }

  onTrackPointerDown(event: PointerEvent): void {
    this.dragging = true;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.engine.pause();
    this.seekFromClientX(event.clientX);
  }

  onTrackPointerMove(event: PointerEvent): void {
    if (this.dragging) {
      this.seekFromClientX(event.clientX);
    }
  }

  onTrackPointerUp(event: PointerEvent): void {
    this.dragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  onTrackKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.engine.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.engine.prev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.engine.restart();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.engine.seekTo(this.engine.lastIndex());
    }
  }

  private seekFromClientX(clientX: number): void {
    const el = this.track()?.nativeElement;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const fraction = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, fraction));
    const index = Math.round(clamped * this.engine.lastIndex());
    this.engine.seekTo(index);
  }

  markerClass(marker: Marker): string {
    if (marker.kind === 'finding') {
      return `tick-finding tick-${marker.severity ?? 'info'}`;
    }
    return `tick-${marker.kind}`;
  }
}
