import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

import { MessageBarComponent } from '../../components/message-bar/message-bar.component';
import { DemoLanguage, DemoStore, TraceEvent } from '../../demo.store';

hljs.registerLanguage('json', json);

type ChatID = 'alice-greeter' | 'bob-reminder' | 'launch-crew';
type PlatformID = 'telegram' | 'whatsapp' | 'messenger' | 'viber' | 'slack' | 'discord';

interface ChatPreview {
  id: ChatID;
  platform: 'telegram' | 'whatsapp';
  platformLabel: string;
  platformIcon: string;
  actor: string;
  bot: string;
  initials: string;
  preview: string;
  time: string;
  unread?: number;
  group?: boolean;
}

interface PlatformOption {
  id: PlatformID;
  label: string;
  icon: string;
  description: string;
  status: 'Ready' | 'Preview' | 'Planned';
  chatID?: ChatID;
}

interface SentChatMessage {
  id: string;
  author: string;
  text: string;
  time: string;
}

@Component({
  selector: 'cw-emulator-page',
  imports: [
    AvatarModule,
    ButtonModule,
    InputTextModule,
    MessageBarComponent,
    RouterLink,
    TagModule,
    TooltipModule
  ],
  templateUrl: './emulator.page.html',
  styleUrl: './emulator.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmulatorPage {
  readonly store: DemoStore;
  readonly messageCanvas = viewChild<ElementRef<HTMLElement>>('messageCanvas');
  readonly messageBar = viewChild(MessageBarComponent);
  readonly activeChat = signal<ChatID>('alice-greeter');
  readonly platformPickerOpen = signal(false);
  readonly platformSelectionNotice = signal<string | null>(null);
  readonly sentMessages = signal<Record<ChatID, SentChatMessage[]>>({
    'alice-greeter': [],
    'bob-reminder': [],
    'launch-crew': []
  });
  readonly activeSentMessages = computed(() => this.sentMessages()[this.activeChat()]);
  readonly activeChatPreview = computed(
    () => this.chats.find((chat) => chat.id === this.activeChat()) ?? this.chats[0]
  );
  readonly activePlatformID = computed(() => this.activeChatPreview().platform);
  readonly activePlatformLabel = computed(() => this.activeChatPreview().platformLabel);
  readonly activePlatformAPIName = computed(() =>
    this.activePlatformID() === 'whatsapp' ? 'WhatsApp Cloud API' : 'Telegram Bot API'
  );
  readonly activePlatformProtocol = computed(() =>
    this.activePlatformID() === 'whatsapp' ? 'whatsapp@cloud-api' : 'telegram@bot-api'
  );
  readonly visibleTraceEvents = computed(() =>
    this.activePlatformID() === 'whatsapp'
      ? this.store.whatsappTraceEvents
      : this.store.traceEvents()
  );
  readonly tracePreview = signal<TraceEvent | null>(null);
  readonly tracePreviewTop = signal(0);
  readonly tracePreviewLeft = signal(0);
  readonly highlightedTracePayload = computed(() => {
    const preview = this.tracePreview();
    return preview
      ? hljs.highlight(JSON.stringify(preview.payload, null, 2), { language: 'json' }).value
      : '';
  });
  private readonly sentMessageSequence = signal(0);

  readonly chats: ChatPreview[] = [
    {
      id: 'alice-greeter',
      platform: 'telegram',
      platformLabel: 'Telegram',
      platformIcon: 'pi pi-send',
      actor: 'Alice',
      bot: 'Greeter bot',
      initials: 'AL',
      preview: 'Howdy stranger! Choose a language…',
      time: 'now'
    },
    {
      id: 'bob-reminder',
      platform: 'whatsapp',
      platformLabel: 'WhatsApp',
      platformIcon: 'pi pi-whatsapp',
      actor: 'Bob',
      bot: 'Reminder bot',
      initials: 'BO',
      preview: 'Renew car insurance in 6 days.',
      time: '2m',
      unread: 1
    },
    {
      id: 'launch-crew',
      platform: 'telegram',
      platformLabel: 'Telegram',
      platformIcon: 'pi pi-send',
      actor: 'Launch crew',
      bot: 'Group chat · 3 actors',
      initials: 'LC',
      preview: '1 scenario still failing.',
      time: '8m',
      group: true
    }
  ];

  readonly platformOptions: PlatformOption[] = [
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'pi pi-send',
      description: 'Bot API · faithful profile',
      status: 'Ready',
      chatID: 'alice-greeter'
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'pi pi-whatsapp',
      description: 'Cloud API · text preview',
      status: 'Preview',
      chatID: 'bob-reminder'
    },
    {
      id: 'messenger',
      label: 'Facebook Messenger',
      icon: 'pi pi-facebook',
      description: 'Messenger Platform',
      status: 'Planned'
    },
    {
      id: 'viber',
      label: 'Viber',
      icon: 'pi pi-phone',
      description: 'Bot API',
      status: 'Planned'
    },
    {
      id: 'slack',
      label: 'Slack',
      icon: 'pi pi-slack',
      description: 'Apps and Events API',
      status: 'Planned'
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: 'pi pi-discord',
      description: 'Gateway and interactions',
      status: 'Planned'
    }
  ];

  constructor(store: DemoStore) {
    this.store = store;
  }

  selectChat(chatID: ChatID): void {
    this.activeChat.set(chatID);
    this.platformPickerOpen.set(false);
    this.platformSelectionNotice.set(null);
  }

  togglePlatformPicker(): void {
    this.platformPickerOpen.update((open) => !open);
    this.platformSelectionNotice.set(null);
  }

  choosePlatform(platform: PlatformOption): void {
    if (platform.chatID) {
      this.selectChat(platform.chatID);
      return;
    }
    this.platformSelectionNotice.set(`${platform.label} is on the adapter roadmap.`);
  }

  translate(code: DemoLanguage['code']): void {
    this.store.translateGreeting(code);
  }

  showTracePreview(domEvent: MouseEvent | FocusEvent, event: TraceEvent): void {
    const target = domEvent.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const width = Math.min(512, window.innerWidth - 32);
    const height = Math.min(500, window.innerHeight - 32);

    this.tracePreviewLeft.set(Math.max(16, rect.left - width - 12));
    this.tracePreviewTop.set(Math.min(Math.max(16, rect.top - 8), window.innerHeight - height - 16));
    this.tracePreview.set(event);
  }

  hideTracePreview(): void {
    this.tracePreview.set(null);
  }

  sendMessage(messageText: string): void {
    const text = messageText.trim();
    if (!text) {
      return;
    }

    const chatID = this.activeChat();
    const sequence = this.sentMessageSequence() + 1;
    const author = chatID === 'bob-reminder' ? 'Bob' : 'Alice';
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    this.sentMessageSequence.set(sequence);
    this.sentMessages.update((messages) => ({
      ...messages,
      [chatID]: [
        ...messages[chatID],
        { id: `${chatID}-${sequence}`, author, text, time }
      ]
    }));
    requestAnimationFrame(() => {
      const canvas = this.messageCanvas()?.nativeElement;
      canvas?.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
    });
  }

  reset(): void {
    this.activeChat.set('alice-greeter');
    this.sentMessages.set({ 'alice-greeter': [], 'bob-reminder': [], 'launch-crew': [] });
    this.sentMessageSequence.set(0);
    this.messageBar()?.clear();
    this.platformPickerOpen.set(false);
    this.platformSelectionNotice.set(null);
    this.tracePreview.set(null);
    this.store.resetRun();
  }
}
