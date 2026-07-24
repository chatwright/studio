import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AnnotationThread, attribution, resolveAnchorMessageKey } from '../../engine/derive';
import { SettledMessage } from '../../engine/settled';
import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';
import { PlatformAction } from '../../model/bundle.types';

/**
 * The animated conversation canvas. Renders settled transcript state and, only
 * during continuous forward playback (and only when reduced-motion is off),
 * plays each mutation's animation primitive: message bar typing → send → land,
 * bot "typing…" → land, edit crossfade morph, vapouring deletion, keyboard
 * slide-in, and eased auto-follow scrolling. Because the rendered messages come
 * from settled state (a pure function of the step index), Prev/Next/scrub land
 * on final state immediately — the animation classes simply aren't applied.
 */
@Component({
  selector: 'cw-transcript',
  imports: [AvatarModule, TagModule, TooltipModule],
  templateUrl: './transcript.component.html',
  styleUrl: './transcript.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TranscriptComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);
  private readonly scrollRegion = viewChild<ElementRef<HTMLElement>>('scrollRegion');

  /** Only the active chat is shown (multi-chat runs switch chats via the nav /
   *  auto-follow). Falls back to the first settled chat. */
  readonly chats = computed(() => {
    const all = this.engine.settled().chats;
    const activeId = this.engine.activeChatId();
    const active = all.find((c) => c.chatId === activeId);
    if (active) {
      return [active];
    }
    return all.length ? [all[0]] : [];
  });

  /** Message keys that open a new part (chapter), mapped to the chapter title.
   *  Drives the subtle part-chapter boundary treatment in the transcript. */
  readonly chapterStarts = computed(() => {
    const run = this.engine.run();
    const starts = new Map<string, string>();
    if (!run) {
      return starts;
    }
    (run.parts ?? []).forEach((part, partIndex) => {
      if (partIndex === 0) {
        return;
      }
      const boundary = part.journalBoundary?.chats?.[0];
      if (!boundary) {
        return;
      }
      const entries = run.chats?.find((c) => c.chatId === boundary.chatId)?.entries ?? [];
      const end = boundary.firstEntry + boundary.entryCount;
      for (let i = boundary.firstEntry; i < end && i < entries.length; i++) {
        const entry = entries[i];
        if (entry.kind === 'message' && entry.version === 0) {
          starts.set(`${boundary.chatId}:${entry.messageId}`, part.title ?? part.id);
          break;
        }
      }
    });
    return starts;
  });

  /** Threads grouped by the message key they anchor to, plus dangling ones. */
  readonly annotationLayout = computed(() => {
    const run = this.engine.run();
    const threads = this.engine.annotationThreads();
    const byKey = new Map<string, AnnotationThread[]>();
    const dangling: AnnotationThread[] = [];
    if (!run) {
      return { byKey, dangling };
    }
    for (const thread of threads) {
      const key = resolveAnchorMessageKey(run, thread.root.annotation.anchor);
      if (key && thread.root.resolved) {
        byKey.set(key, [...(byKey.get(key) ?? []), thread]);
      } else {
        dangling.push(thread);
      }
    }
    return { byKey, dangling };
  });

  constructor() {
    // Eased auto-follow scrolling, paced with the playhead.
    effect(() => {
      this.engine.stepIndex();
      this.engine.messageBarTyping();
      const region = this.scrollRegion()?.nativeElement;
      if (!region) {
        return;
      }
      const behavior: ScrollBehavior = this.engine.reducedMotion() ? 'auto' : 'smooth';
      requestAnimationFrame(() => region.scrollTo({ top: region.scrollHeight, behavior }));
    });
  }

  who(fromId: number): { name: string; type: string; handle: string } {
    const run = this.engine.run();
    if (!run) {
      return { name: 'User', type: '', handle: '' };
    }
    const resolved = attribution(run, fromId);
    const identity = resolved.actor?.platformIdentities?.[run.platform];
    const handle = identity?.username ? `@${identity.username}` : identity?.firstName ?? '';
    return { name: resolved.displayName, type: resolved.actor?.type ?? '', handle };
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  isTypingTarget(message: SettledMessage): boolean {
    const typing = this.engine.messageBarTyping();
    return (
      !!typing &&
      this.engine.animatingIndex() === message.timelineIndex &&
      message.direction === 'user'
    );
  }

  messageAnim(message: SettledMessage): string {
    const animating =
      this.engine.animatingIndex() === message.timelineIndex && !this.engine.reducedMotion();
    if (message.deleted) {
      return animating ? 'vapoured vapouring' : 'vapoured';
    }
    if (!animating) {
      return '';
    }
    if (this.isTypingTarget(message)) {
      return 'awaiting';
    }
    if (message.edited && message.history.length > 1) {
      return 'morphing';
    }
    return message.direction === 'user' ? 'landing-user' : 'landing-bot';
  }

  previousText(message: SettledMessage): string {
    const history = message.history;
    return history.length > 1 ? history[history.length - 2].text : '';
  }

  isActionPressed(message: SettledMessage, action: PlatformAction): boolean {
    return message.pressedActionIds.includes(action.id);
  }

  threadsFor(message: SettledMessage): AnnotationThread[] {
    return this.annotationLayout().byKey.get(message.key) ?? [];
  }

  threadCount(message: SettledMessage): number {
    return this.threadsFor(message).reduce((sum, thread) => sum + 1 + thread.replies.length, 0);
  }

  onMessageClick(message: SettledMessage): void {
    this.ui.inspectMessage(message.chatId, message.messageId);
  }

  onActionClick(message: SettledMessage, action: PlatformAction, domEvent: Event): void {
    domEvent.stopPropagation();
    this.ui.inspectMessage(message.chatId, message.messageId, action.id);
  }

  onAddComment(message: SettledMessage, domEvent: Event): void {
    domEvent.stopPropagation();
    this.ui.startAnnotation({
      chatId: message.chatId,
      entryIndex: message.entryIndex,
      messageId: message.messageId,
      version: message.version
    });
  }

  onPinClick(message: SettledMessage, thread: AnnotationThread, domEvent: Event): void {
    domEvent.stopPropagation();
    // Reveal this message's comments in the Annotations tab, filtered to it.
    this.ui.showAnnotationsFor(message.key, thread.root.annotation.id);
  }
}
