import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { DemoStore } from '../../demo.store';
import { MessageBarComponent } from '../../components/message-bar/message-bar.component';
import { ChatPaneComponent } from './chat-pane/chat-pane.component';
import { PlaygroundTab, resolveInitialTab } from './default-tab';
import { resolveInitialShowBotInternals } from './internals-default';

export type { PlaygroundTab };

/**
 * `/studio/playground` — a live, in-browser conversation with a real bot
 * (today: greetbot) over the Chatwright iframe bot protocol. Unlike
 * `/player` (replays a *finished* run-bundle file) and `/emulator` (a
 * static, scripted mock), this page drives actual `@chatwright/runtime`
 * `Session` + `IframeHost` instances against the bot's real iframe page —
 * every bubble on screen is a live fold over that session's journal, not
 * pre-recorded or faked. All of that machinery now lives in
 * `./chat-pane/chat-pane.component.ts` (`ChatPaneComponent`), one live
 * platform pane; this page is the thin shell around it: a platform tab
 * strip (Telegram | WhatsApp | ⚡ Compare) plus, in Compare mode, the one
 * shared message bar that fans a submitted message out to both panes' own
 * sessions at once.
 *
 * @remarks
 * **Why one message bar, two sessions, not one session, two platforms:** the
 * runtime's `Session` is deliberately single-codec (see
 * `@chatwright/runtime`'s `Session` doc comment) — a `PlatformCodec` is the
 * only thing allowed to know a platform's wire shape, and mixing two into
 * one session would blur that seam. Compare mode instead runs two
 * completely independent `ChatPaneComponent`s (two `Session`s, two
 * `IframeHost`s, two greetbot iframes) side by side, and this page's own
 * `onCompareSend` is the only thing that ties them together: it calls
 * `submitText()` on both, which is exactly what a human doing the same
 * two-tab comparison by hand would do, just synchronized.
 *
 * Compare mode's bot-internals story is likewise "one, not two": rather than
 * each pane showing its own internals rail (the single-platform-tab
 * behavior — see `ChatPaneComponent`'s own doc comment), this page owns ONE
 * `compareShowInternals` toggle and projects BOTH panes' live bot iframes —
 * via each pane's own exposed `botFrameTpl()` `TemplateRef` and
 * `NgTemplateOutlet` — into ONE shared panel, clearly labelled Telegram /
 * WhatsApp. It's the same bot on both platforms, so one place to watch the
 * wire rather than two. Always closed by default regardless of viewport
 * (`resolveInitialShowBotInternals('compare', …)` — see internals-
 * default.ts's doc comment for why that differs from the single-platform
 * viewport-based default) — a visitor opts in explicitly.
 *
 * Deliberately out of scope for this slice (see I-66 in
 * chatwright/chatwright spec/research/knowledge-platform.md): more than one
 * bot per platform, a bot registry/picker, scenario execution beyond direct
 * submitText/submitClick, a live-append path into the /player engine, and —
 * noted explicitly rather than silently dropped — a single *combined*
 * comparison run-bundle. Compare mode's "Download recording" stays
 * per-pane (two independent bundles, one per `Session`); the run-bundle v1
 * format already has a `runs[]` array built for exactly this (one bundle,
 * multiple runs/platforms) — assembling one from two live panes is a
 * natural follow-up, not attempted here.
 */
@Component({
  selector: 'cw-playground-page',
  imports: [MessageBarComponent, ChatPaneComponent, NgTemplateOutlet],
  templateUrl: './playground.page.html',
  styleUrl: './playground.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaygroundPage {
  readonly store = inject(DemoStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Founder tweak: Compare is the default on wide viewports (room for two
  // panes side by side), Telegram on narrow ones — an explicit `?tab=`
  // query param always overrides both, and `setTab` writes it back on every
  // switch (`replaceUrl: true`, Angular's own `history.replaceState` wrapper
  // — see run.page.ts's `selectTrace`/`selectDetailTab` for the same idiom
  // already established elsewhere in this app) so a shared/bookmarked link
  // reproduces exactly the tab a visitor was looking at. The viewport check
  // and query-param read happen here (Angular's own APIs); the actual
  // decision is `resolveInitialTab`, a pure function unit-tested on its own
  // in default-tab.spec.ts.
  readonly activeTab = signal<PlaygroundTab>(
    resolveInitialTab(this.route.snapshot.queryParamMap.get('tab'), isWideViewport())
  );

  // Single-platform tabs mount one self-contained pane (own message bar,
  // showMessageBar defaults true) — this page needs no handle on it at all.
  //
  // Compare mode mounts two panes with showMessageBar=false and drives both
  // from the shared message bar below via these two refs. Angular's viewChild
  // resolves the currently-rendered template reference regardless of which
  // `@switch`/`@if` branch put it there — only one branch is ever active at
  // a time, so there is never an ambiguity between them.
  private readonly comparePaneTelegram = viewChild<ChatPaneComponent>('comparePaneTelegram');
  private readonly comparePaneWhatsapp = viewChild<ChatPaneComponent>('comparePaneWhatsapp');
  /** Only resolves once both panes are connected AND the conversation has started — see `compare-message-bar-surface` in the template. */
  private readonly compareMessageBar = viewChild<MessageBarComponent>('compareMessageBar');

  readonly compareBothConnected = computed(
    () => this.comparePaneTelegram()?.status() === 'connected' && this.comparePaneWhatsapp()?.status() === 'connected'
  );

  /** Founder tweak: gates the shared Start button vs. the shared message bar in Compare mode's one message bar slot — either pane having content means the fan-out already started this conversation. */
  readonly compareHasContent = computed(
    () => (this.comparePaneTelegram()?.hasContent() ?? false) || (this.comparePaneWhatsapp()?.hasContent() ?? false)
  );

  /** Founder tweak: Compare mode's ONE shared "Show bot internals" control — always closed at mount regardless of viewport, unlike a single-platform tab's own toggle. See this class's + internals-default.ts's doc comments. */
  readonly compareShowInternals = signal(resolveInitialShowBotInternals('compare', isWideViewportForInternals()));
  /** Each pane's own live bot iframe, exposed as a `TemplateRef` for this page's shared internals panel to project via `NgTemplateOutlet` — `null` before that pane has mounted (e.g. Compare hasn't been switched to yet, or the pane hasn't finished its first render). */
  readonly compareTelegramInternalsTpl = computed(() => this.comparePaneTelegram()?.botFrameTpl() ?? null);
  readonly compareWhatsappInternalsTpl = computed(() => this.comparePaneWhatsapp()?.botFrameTpl() ?? null);

  readonly compareStatusNote = computed(() => {
    const telegramStatus = this.comparePaneTelegram()?.status() ?? 'handshaking';
    const whatsappStatus = this.comparePaneWhatsapp()?.status() ?? 'handshaking';
    if (telegramStatus === 'error' || whatsappStatus === 'error') {
      return 'Message bar unavailable — a bot never connected.';
    }
    if (telegramStatus === 'connected' && whatsappStatus !== 'connected') {
      return 'Telegram connected — waiting on WhatsApp…';
    }
    if (whatsappStatus === 'connected' && telegramStatus !== 'connected') {
      return 'WhatsApp connected — waiting on Telegram…';
    }
    return 'Message bar opens once both bots connect…';
  });

  constructor() {
    // Founder tweak: same focus-after-start move as each ChatPaneComponent
    // makes for its own message bar (see that component's constructor) —
    // Compare mode's shared message bar is owned here instead, so it needs its
    // own copy of the same effect. Reruns automatically once
    // `compareMessageBar()` resolves if it wasn't there yet on the tick
    // `compareHasContent()` flipped true, same reasoning as the per-pane one.
    effect(() => {
      if (this.compareHasContent()) {
        this.compareMessageBar()?.focus();
      }
    });
  }

  setTab(tab: PlaygroundTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /** The shared message bar's one send fans out to both panes' independent sessions — see this class's doc comment. */
  onCompareSend(text: string): void {
    this.comparePaneTelegram()?.submitText(text);
    this.comparePaneWhatsapp()?.submitText(text);
  }

  /** Founder tweak: Compare mode's own Start affordance — sends `/start` to both panes via the same fan-out `onCompareSend` uses for a typed message. */
  startCompareConversation(): void {
    this.onCompareSend('/start');
  }
}

/** `matchMedia` viewport check for the default-tab rule — see `resolveInitialTab`'s doc comment. */
function isWideViewport(): boolean {
  if (typeof matchMedia !== 'function') {
    return false;
  }
  return matchMedia('(min-width: 1024px)').matches;
}

/**
 * `matchMedia` read feeding `compareShowInternals`'s `resolveInitialShowBotInternals('compare', …)` call — fed
 * through for real (rather than hardcoding `false` inline) so that call site honestly proves, at a glance, it
 * ignores the viewport for Compare's "always closed" rule rather than merely happening to already be closed
 * because nobody checked. Same 1280px breakpoint as a single-platform tab's own default (chat-pane.component.ts's
 * `isWideViewportForInternals`) — duplicated rather than imported, matching this file's existing `isWideViewport`
 * (1024px, the tab-default rule) already being its own local helper rather than shared across files.
 */
function isWideViewportForInternals(): boolean {
  if (typeof matchMedia !== 'function') {
    return false;
  }
  return matchMedia('(min-width: 1280px)').matches;
}
