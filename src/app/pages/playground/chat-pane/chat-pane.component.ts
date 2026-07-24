import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { IframeHost, Session, WhatsAppCodec, type JournalEntry, type TelegramUser } from '@chatwright/runtime';

import { DemoStore } from '../../../demo.store';
import { ChatComposerComponent } from '../../../components/chat-composer/chat-composer.component';
import { JournalActionLike, PlaygroundBubble, reduceJournalEntries } from '../bubble-reducer';
import { CommandSegment, tokenizeCommandText } from '../command-tokenizer';

export type PlaygroundPlatform = 'telegram' | 'whatsapp';
export type ConnectionStatus = 'handshaking' | 'connected' | 'error';

/** The bots under test — see formats/bot-protocol/v1/README.md for the handshake this drives. Both live under the same origin. */
const BOT_ORIGIN = 'https://chatwright.github.io';
const BOT_REPO_URL = 'https://github.com/chatwright/greetbot';

/** Per-platform bot metadata — the one place a pane looks up "which bot, what identity" from its `platform` input. */
const BOT_META: Record<
  PlaygroundPlatform,
  { readonly iframeSrc: string; readonly icon: string; readonly label: string; readonly botId: string; readonly botName: string }
> = {
  telegram: {
    iframeSrc: `${BOT_ORIGIN}/greetbot/telegram/`,
    icon: 'pi pi-send',
    label: 'Telegram',
    botId: 'greetbot-telegram',
    botName: 'GreetBot'
  },
  whatsapp: {
    iframeSrc: `${BOT_ORIGIN}/greetbot/whatsapp/`,
    icon: 'pi pi-whatsapp',
    label: 'WhatsApp',
    botId: 'greetbot-whatsapp',
    botName: 'GreetBot'
  }
};

/** How long to wait for the bot's `hello` before honestly reporting a stalled handshake. */
const HANDSHAKE_POLL_MS = 150;
const HANDSHAKE_TIMEOUT_MS = 12_000;

/** The one fixed visitor identity this slice drives — see I-66 for a multi-bot/multi-actor registry. */
const VISITOR: TelegramUser = { id: 42, firstName: 'Visitor' };
/** Telegram private-chat convention (WhatsApp mirrors it here too, purely as this slice's own chat-id scheme — a 1:1 chat id is the visitor's user id). */
const CHAT_ID = VISITOR.id;

/**
 * One live platform pane: its own `@chatwright/runtime` `Session` +
 * `IframeHost` driving the greetbot iframe for `platform()`, folded into
 * bubbles via `reduceJournalEntries` exactly as the original single-platform
 * Playground did (see ./playground.page.ts's doc comment for the "why live,
 * not replayed" framing this inherits unchanged).
 *
 * @remarks
 * Extracted so the same live-pane machinery backs three contexts: the
 * Telegram tab, the WhatsApp tab, and each half of Compare mode — never
 * duplicated three times. `showComposer()` is what tells them apart: the
 * two single-platform tabs render their own `cw-chat-composer`; Compare mode
 * sets it `false` and drives both panes' `submitText()` from one shared
 * composer in the parent (`PlaygroundPage`), via a template reference
 * variable — see that component's `onCompareSend`. Button clicks stay
 * per-pane either way (`onActionClick`) — they are answered by whichever
 * bot rendered them, never fanned out.
 *
 * `platform()` picks this pane's codec too: WhatsApp drives
 * `Session` with a `WhatsAppCodec` (text-only — no inline keyboards, no
 * in-place edits, the greeting always arrives as a new message); Telegram
 * relies on `Session`'s own `TelegramCodec` default. `onActionClick` never
 * calls `submitClick` for a WhatsApp pane — belt-and-braces, since the
 * WhatsApp codec's journal never carries `actions` in the first place (see
 * `WhatsAppCodec`'s own doc comment), so no button ever renders to click —
 * but `Session.submitClick` itself throws for a codec with no
 * interactive-action support, and this guard keeps that throw from ever
 * being reachable via this pane's own UI.
 */
@Component({
  selector: 'cw-chat-pane',
  imports: [AvatarModule, ButtonModule, TooltipModule, ChatComposerComponent],
  templateUrl: './chat-pane.component.html',
  styleUrl: './chat-pane.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatPaneComponent implements AfterViewInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  readonly store = inject(DemoStore);

  readonly platform = input.required<PlaygroundPlatform>();
  /** Compare mode supplies its own shared composer and sets this `false`. */
  readonly showComposer = input(true);
  /** Tighter chrome for Compare mode's side-by-side layout. */
  readonly compact = input(false);

  readonly botMeta = computed(() => BOT_META[this.platform()]);
  readonly botIframeSrc = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.botMeta().iframeSrc)
  );
  readonly botRepoUrl = BOT_REPO_URL;
  readonly botOrigin = BOT_ORIGIN;

  private readonly botFrame = viewChild<ElementRef<HTMLIFrameElement>>('botFrame');
  private readonly chatScroll = viewChild<ElementRef<HTMLElement>>('chatScroll');
  /** Only resolves once `showComposer()` mounts this pane's own composer — Compare mode's panes (`showComposer=false`) never populate this, they don't own a composer to focus. */
  private readonly composer = viewChild<ChatComposerComponent>('composer');

  readonly status = signal<ConnectionStatus>('handshaking');
  readonly errorReason = signal<string | null>(null);
  /** Founder tweak: open by default on large screens (matchMedia at init only — the toggle button owns it from then on). */
  readonly showBotInternals = signal(initialShowBotInternals());
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

  private session: Session | undefined;
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

    // Founder tweak: once the conversation starts (Start button or typing a
    // first message straight into the composer), move focus into the
    // composer's text input. `hasContent()` flips false -> true exactly
    // once per pane's lifetime, at which point the template swaps the
    // Start-button composer slot for the real `cw-chat-composer` — this
    // effect also reads `composer()` (itself a signal), so if that swap
    // hasn't landed in the DOM yet on the tick `hasContent()` flips, the
    // effect simply reruns the moment `composer()` resolves, no manual
    // rAF/microtask polling needed. A no-op for Compare mode's panes
    // (`showComposer=false`): `composer()` never resolves there — the
    // parent `PlaygroundPage` owns that focus move for its shared composer.
    effect(() => {
      if (this.hasContent()) {
        this.composer()?.focus();
      }
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
    this.submitText('/start');
  }

  /** Delivers `text` to this pane's own session — called by its own composer (single-platform tabs) or fanned out to by the parent's shared composer (Compare mode). */
  submitText(text: string): void {
    if (this.status() !== 'connected' || !this.session) {
      return;
    }
    this.session.submitText(CHAT_ID, VISITOR, text);
  }

  onActionClick(item: PlaygroundBubble, action: JournalActionLike): void {
    // WhatsApp's codec declares no interactive-action support (text-only,
    // no inline keyboards) — its journal never carries actions either, so
    // this is unreachable via the UI already; kept as an explicit guard
    // rather than relying on that silently, per Session.submitClick's own
    // honest throw for a codec that omits buildCallbackUpdate.
    if (this.platform() === 'whatsapp') {
      return;
    }
    if (this.status() !== 'connected' || !this.session) {
      return;
    }
    this.session.submitClick(CHAT_ID, VISITOR, action.id, item.messageId);
  }

  isPressed(messageId: number, actionId: string): boolean {
    return this.timeline().pressedActionIds.get(messageId)?.has(actionId) ?? false;
  }

  /**
   * Founder tweak: `/command` tokens inside a bubble's text render as
   * clickable links, Telegram panes only — the template gates this on
   * `platform() === 'telegram'`, never called for a WhatsApp pane, matching
   * how real WhatsApp renders `/start` as inert plain text. Pure fold, no
   * HTML string ever built — the template maps this array straight to
   * text/`<button>` nodes itself (split-and-map), so there is nothing here
   * that could be handed to `[innerHTML]`.
   */
  commandSegments(text: string): readonly CommandSegment[] {
    return tokenizeCommandText(text);
  }

  /** A clicked `/command` token sends that literal text as a new user message — same path as typing it into the composer. */
  onCommandClick(command: string): void {
    this.submitText(command);
  }

  /** `session.toBundle()` → Blob → download; returns the file name for the caller's own note. */
  downloadRecording(): string {
    const bundle = this.session?.toBundle() ?? {};
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fileName = bundleFileName(this.platform());
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

    const platform = this.platform();
    const meta = this.botMeta();
    this.session = new Session({
      runId: 'playground',
      human: { id: 'visitor', type: 'human', name: 'Visitor' },
      bot: { id: meta.botId, type: 'bot', name: meta.botName },
      codec: platform === 'whatsapp' ? new WhatsAppCodec() : undefined
    });

    const host = new IframeHost(
      { expectedOrigin: this.botOrigin, platform },
      { kind: 'window', hostWindow: window, botWindow: contentWindow }
    );
    this.host = host;
    this.session.registerBot(host);

    // Created eagerly (rather than lazily on first submit) so subscribe()
    // catches every entry the bot itself produces from the moment it connects.
    const journal = this.session.journal(CHAT_ID);
    journal.subscribe((entry) => this.entries.update((list) => [...list, entry]));

    iframe.addEventListener('error', () => this.fail(`The ${meta.label} bot iframe failed to load.`));

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
          `No handshake from ${this.botOrigin} within ${Math.round(HANDSHAKE_TIMEOUT_MS / 1000)}s — the bot may not ` +
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

function bundleFileName(platform: PlaygroundPlatform): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `session-${platform}-${stamp}.chatwright.json`;
}

/** `matchMedia` initial value for `showBotInternals` — same "declare, don't assume" guard as `DemoStore`'s `initialAppTheme`. */
function initialShowBotInternals(): boolean {
  if (typeof matchMedia !== 'function') {
    return false;
  }
  return matchMedia('(min-width: 1280px)').matches;
}
