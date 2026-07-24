import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { DemoStore } from '../../demo.store';
import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { ChatPaneComponent } from './chat-pane/chat-pane.component';
import { PlaygroundTab, resolveInitialTab } from './default-tab';

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
 * shared composer that fans a submitted message out to both panes' own
 * sessions at once.
 *
 * @remarks
 * **Why one composer, two sessions, not one session, two platforms:** the
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
  imports: [ChatComposerComponent, ChatPaneComponent],
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

  // Single-platform tabs mount one self-contained pane (own composer,
  // showComposer defaults true) — this page needs no handle on it at all.
  //
  // Compare mode mounts two panes with showComposer=false and drives both
  // from the shared composer below via these two refs. Angular's viewChild
  // resolves the currently-rendered template reference regardless of which
  // `@switch`/`@if` branch put it there — only one branch is ever active at
  // a time, so there is never an ambiguity between them.
  private readonly comparePaneTelegram = viewChild<ChatPaneComponent>('comparePaneTelegram');
  private readonly comparePaneWhatsapp = viewChild<ChatPaneComponent>('comparePaneWhatsapp');
  /** Only resolves once both panes are connected AND the conversation has started — see `compare-composer-surface` in the template. */
  private readonly compareComposer = viewChild<ChatComposerComponent>('compareComposer');

  readonly compareBothConnected = computed(
    () => this.comparePaneTelegram()?.status() === 'connected' && this.comparePaneWhatsapp()?.status() === 'connected'
  );

  /** Founder tweak: gates the shared Start button vs. the shared composer in Compare mode's one composer slot — either pane having content means the fan-out already started this conversation. */
  readonly compareHasContent = computed(
    () => (this.comparePaneTelegram()?.hasContent() ?? false) || (this.comparePaneWhatsapp()?.hasContent() ?? false)
  );

  readonly compareStatusNote = computed(() => {
    const telegramStatus = this.comparePaneTelegram()?.status() ?? 'handshaking';
    const whatsappStatus = this.comparePaneWhatsapp()?.status() ?? 'handshaking';
    if (telegramStatus === 'error' || whatsappStatus === 'error') {
      return 'Composer unavailable — a bot never connected.';
    }
    if (telegramStatus === 'connected' && whatsappStatus !== 'connected') {
      return 'Telegram connected — waiting on WhatsApp…';
    }
    if (whatsappStatus === 'connected' && telegramStatus !== 'connected') {
      return 'WhatsApp connected — waiting on Telegram…';
    }
    return 'Composer opens once both bots connect…';
  });

  constructor() {
    // Founder tweak: same focus-after-start move as each ChatPaneComponent
    // makes for its own composer (see that component's constructor) —
    // Compare mode's shared composer is owned here instead, so it needs its
    // own copy of the same effect. Reruns automatically once
    // `compareComposer()` resolves if it wasn't there yet on the tick
    // `compareHasContent()` flipped true, same reasoning as the per-pane one.
    effect(() => {
      if (this.compareHasContent()) {
        this.compareComposer()?.focus();
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

  /** The shared composer's one send fans out to both panes' independent sessions — see this class's doc comment. */
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
