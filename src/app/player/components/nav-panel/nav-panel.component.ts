import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { attribution } from '../../engine/derive';
import { PlayerEngine } from '../../player-engine';
import { PlayerUiState } from '../../player-ui';

interface ChatSummary {
  chatId: number;
  title: string;
  participants: string[];
  preview: string;
  entryCount: number;
}

interface RunSummary {
  index: number;
  id: string;
  platform: string;
  chatCount: number;
}

/**
 * Left navigation: a run selector plus the list of chats in the current run.
 * The transcript shows the selected chat; during playback the engine
 * auto-follows the chat where the current step happens, and the pin holds one
 * chat while stepping (round 2, item 2). Collapsed, the rail still shows the
 * current run/chat title.
 */
@Component({
  selector: 'cw-nav-panel',
  imports: [TagModule, TooltipModule],
  templateUrl: './nav-panel.component.html',
  styleUrl: './nav-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavPanelComponent {
  readonly engine = inject(PlayerEngine);
  readonly ui = inject(PlayerUiState);

  readonly runs = computed<RunSummary[]>(() =>
    (this.engine.bundle()?.runs ?? []).map((run, index) => ({
      index,
      id: run.id,
      platform: run.platform,
      chatCount: run.chats?.length ?? 0
    }))
  );

  readonly chatSummaries = computed<ChatSummary[]>(() => {
    const run = this.engine.run();
    if (!run) {
      return [];
    }
    return (run.chats ?? []).map((chat) => {
      const entries = chat.entries ?? [];
      const fromIds = [...new Set(entries.map((e) => e.FromID).filter((id) => id !== 0))];
      const participants = fromIds.map((id) => attribution(run, id).displayName);
      const lastMessage = [...entries].reverse().find((e) => e.Kind === 'message' && !!e.Text);
      return {
        chatId: chat.chatId,
        title: `Chat ${chat.chatId}`,
        participants,
        preview: lastMessage?.Text ?? '—',
        entryCount: entries.length
      };
    });
  });

  readonly activeRunTitle = computed(() => this.engine.run()?.id ?? '—');

  isActiveChat(chatId: number): boolean {
    return this.engine.activeChatId() === chatId;
  }

  isLiveChat(chatId: number): boolean {
    return this.engine.currentChatId() === chatId;
  }

  isPinned(chatId: number): boolean {
    return this.engine.pinnedChatId() === chatId;
  }

  selectRun(index: number): void {
    this.engine.selectRun(index);
    this.ui.closeInspector();
  }

  selectChat(chatId: number): void {
    this.engine.setActiveChat(chatId);
  }

  togglePin(): void {
    this.engine.togglePin();
  }

  pinChat(chatId: number): void {
    this.engine.pinChat(chatId);
  }
}
