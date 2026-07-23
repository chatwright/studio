import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { IframeHost, Session, type JournalEntry, type TelegramUser } from '@chatwright/runtime';

import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { JournalActionLike, PlaygroundBubble, reduceJournalEntries } from './bubble-reducer';

type ConnectionStatus = 'handshaking' | 'connected' | 'error';

/** The bot under test — see formats/bot-protocol/v1/README.md for the handshake this drives. */
const BOT_ORIGIN = 'https://chatwright.github.io';
const BOT_IFRAME_SRC = 'https://chatwright.github.io/greetbot/telegram/';
const BOT_REPO_URL = 'https://github.com/chatwright/greetbot';

/** How long to wait for the bot's `hello` before honestly reporting a stalled handshake. */
const HANDSHAKE_POLL_MS = 150;
const HANDSHAKE_TIMEOUT_MS = 12_000;

/** The one fixed visitor identity this slice drives — see I-66 for a multi-bot/multi-actor registry. */
const VISITOR: TelegramUser = { id: 42, firstName: 'Visitor' };
/** Telegram private-chat convention: a 1:1 chat's id is the human participant's user id. */
const CHAT_ID = VISITOR.id;

/**
 * `/studio/playground` — a live, in-browser conversation with a real bot
 * (today: greetbot) over the Chatwright iframe bot protocol. Unlike
 * `/player` (replays a *finished* run-bundle file) and `/emulator` (a
 * static, scripted mock), this page drives an actual
 * `@chatwright/runtime` `Session` + `IframeHost` against the bot's real
 * iframe page: every bubble on screen is a live fold
 * (`reduceJournalEntries`, see ./bubble-reducer.ts) over that session's
 * journal, appended to as `Journal.subscribe()` delivers entries — nothing
 * here is pre-recorded or faked. "Download recording" / "Replay in
 * player" hand the resulting run-bundle (`session.toBundle()`) to the same
 * `*.chatwright.json` format `/player` already reads.
 *
 * @remarks
 * Deliberately out of scope for this slice (see I-66 in
 * chatwright/chatwright spec/research/knowledge-platform.md): more than
 * one bot per session, a bot registry/picker, scenario execution beyond
 * direct submitText/submitClick, and a live-append path into the /player
 * engine (today /player only plays finished bundles — this page's own
 * transcript rendering is a separate, simpler live fold, not a reuse of
 * the player's settled-fold engine).
 */
@Component({
  selector: 'cw-playground-page',
  imports: [AvatarModule, ButtonModule, TooltipModule, ChatComposerComponent],
  templateUrl: './playground.page.html',
  styleUrl: './playground.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaygroundPage implements AfterViewInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  readonly botIframeSrc: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(BOT_IFRAME_SRC);
  readonly botRepoUrl = BOT_REPO_URL;
  readonly botOrigin = BOT_ORIGIN;

  private readonly botFrame = viewChild<ElementRef<HTMLIFrameElement>>('botFrame');
  private readonly chatScroll = viewChild<ElementRef<HTMLElement>>('chatScroll');

  readonly status = signal<ConnectionStatus>('handshaking');
  readonly errorReason = signal<string | null>(null);
  readonly showBotInternals = signal(false);
  readonly noteMessage = signal<string | null>(null);

  readonly entries = signal<JournalEntry[]>([]);
  readonly timeline = computed(() => reduceJournalEntries(this.entries()));
  readonly hasContent = computed(() => this.entries().length > 0);

  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'handshaking':
        return 'handshaking…';
      case 'connected':
        return 'connected';
      case 'error':
        return `error — ${this.errorReason() ?? 'unknown reason'}`;
    }
  });

  private readonly session = new Session({
    runId: 'playground',
    human: { id: 'visitor', type: 'human', name: 'Visitor' },
    bot: { id: 'greetbot', type: 'bot', name: 'GreetBot' }
  });

  private host: IframeHost | undefined;
  private handshakeTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Auto-follow the transcript as new entries land — same idiom as the
    // player transcript and the live emulator's message canvas.
    effect(() => {
      this.entries();
      const region = this.chatScroll()?.nativeElement;
      if (!region) {
        return;
      }
      requestAnimationFrame(() => region.scrollTo({ top: region.scrollHeight, behavior: 'smooth' }));
    });
  }

  ngAfterViewInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    if (this.handshakeTimer !== undefined) {
      clearInterval(this.handshakeTimer);
    }
    this.host?.close();
  }

  /** The `/start` affordance: the visitor acts, this never auto-sends. */
  startConversation(): void {
    this.session.submitText(CHAT_ID, VISITOR, '/start');
  }

  onSend(text: string): void {
    this.session.submitText(CHAT_ID, VISITOR, text);
  }

  onActionClick(item: PlaygroundBubble, action: JournalActionLike): void {
    if (this.status() !== 'connected') {
      return;
    }
    this.session.submitClick(CHAT_ID, VISITOR, action.id, item.messageId);
  }

  isPressed(messageId: number, actionId: string): boolean {
    return this.timeline().pressedActionIds.get(messageId)?.has(actionId) ?? false;
  }

  /** `session.toBundle()` → Blob → download; returns the file name for the caller's own note. */
  downloadRecording(): string {
    const bundle = this.session.toBundle();
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fileName = bundleFileName();
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.noteMessage.set(`Downloaded ${fileName}.`);
    return fileName;
  }

  /**
   * Opens /player in a new tab and tells the visitor to drop the just-
   * downloaded file onto it — no upload plumbing in this slice (that file
   * never touches a network request; /player's own drag-and-drop reads it
   * straight off disk, exactly as it does for any other run bundle).
   */
  replayInPlayer(): void {
    const fileName = this.downloadRecording();
    this.noteMessage.set(`Downloaded ${fileName} — opening the Player. Drop that file onto it to replay this session.`);
    const playerUrl = new URL('player', document.baseURI).href;
    window.open(playerUrl, '_blank', 'noopener');
  }

  private connect(): void {
    const iframe = this.botFrame()?.nativeElement;
    const contentWindow = iframe?.contentWindow;
    if (!iframe || !contentWindow) {
      this.fail('Could not access the greetbot iframe window.');
      return;
    }

    const host = new IframeHost(
      { expectedOrigin: BOT_ORIGIN, platform: 'telegram' },
      { kind: 'window', hostWindow: window, botWindow: contentWindow }
    );
    this.host = host;
    this.session.registerBot(host);

    // Created eagerly (rather than lazily on first submit) so subscribe()
    // catches every entry the bot itself produces from the moment it connects.
    const journal = this.session.journal(CHAT_ID);
    journal.subscribe((entry) => this.entries.update((list) => [...list, entry]));

    iframe.addEventListener('error', () => this.fail('The greetbot iframe failed to load.'));

    const deadline = Date.now() + HANDSHAKE_TIMEOUT_MS;
    this.handshakeTimer = setInterval(() => {
      if (host.connected) {
        this.stopHandshakePoll();
        this.status.set('connected');
        return;
      }
      if (Date.now() > deadline) {
        this.stopHandshakePoll();
        this.fail(
          `No handshake from ${BOT_ORIGIN} within ${Math.round(HANDSHAKE_TIMEOUT_MS / 1000)}s — the bot may not ` +
            'have loaded, or its declared origin does not match expectedOrigin.'
        );
      }
    }, HANDSHAKE_POLL_MS);
  }

  private stopHandshakePoll(): void {
    if (this.handshakeTimer !== undefined) {
      clearInterval(this.handshakeTimer);
      this.handshakeTimer = undefined;
    }
  }

  private fail(reason: string): void {
    this.status.set('error');
    this.errorReason.set(reason);
  }
}

function bundleFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `session-${stamp}.chatwright.json`;
}
