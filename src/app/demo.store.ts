import { Injectable, computed, signal } from '@angular/core';

export interface DemoLanguage {
  code: 'en' | 'es' | 'uk' | 'fr';
  label: string;
  shortLabel: string;
  flag: string;
  greeting: string;
  callbackID: string;
}

export interface TraceEvent {
  time: string;
  kind: 'actor' | 'http' | 'api' | 'state' | 'assertion';
  title: string;
  detail: string;
  operation: string;
  status: string;
  durationMs: number;
  payload: unknown;
  timings: Array<{ label: string; valueMs: number }>;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly workspace = 'greetbot';
  readonly scenario = 'language-choice';
  readonly runID = 'run-1842';
  /**
   * The Studio shell's own light/dark theme — manually toggled from the top
   * bar (`AppComponent`'s `theme-toggle`); that toggle is the source of
   * truth for the rest of the app's session, this is only its *initial*
   * value. Falls back to the OS/browser's `prefers-color-scheme` when
   * available (SSR/non-browser environments have no `matchMedia`, hence the
   * guard) rather than hardcoding light — the same "declare, don't assume"
   * spirit the runtime's fidelity rules follow, applied to a UI default.
   */
  readonly appTheme = signal<'light' | 'dark'>(initialAppTheme());
  /**
   * Every live chat surface (the Playground's panes, the live emulator, the
   * run inspector's rendered view) renders the INVERSE of the Studio
   * shell's theme — a phone-like messenger reads wrong sitting flush with
   * dev-tool chrome in the same theme. See chat-pane.component.scss's own
   * doc comment for where this is consumed.
   */
  readonly telegramTheme = computed<'light' | 'dark'>(() =>
    this.appTheme() === 'light' ? 'dark' : 'light'
  );

  readonly languages: DemoLanguage[] = [
    {
      code: 'en',
      label: 'English',
      shortLabel: 'EN',
      flag: '🇬🇧',
      greeting: 'Howdy stranger! Choose a language for this conversation.',
      callbackID: 'lang:en'
    },
    {
      code: 'es',
      label: 'Español',
      shortLabel: 'ES',
      flag: '🇪🇸',
      greeting: '¡Hola, forastero! Elige un idioma para esta conversación.',
      callbackID: 'lang:es'
    },
    {
      code: 'uk',
      label: 'Українська',
      shortLabel: 'UK',
      flag: '🇺🇦',
      greeting: 'Привіт, мандрівнику! Обери мову для цієї розмови.',
      callbackID: 'lang:uk'
    },
    {
      code: 'fr',
      label: 'Français',
      shortLabel: 'FR',
      flag: '🇫🇷',
      greeting: 'Salut, voyageur ! Choisis la langue de cette conversation.',
      callbackID: 'lang:fr'
    }
  ];

  readonly selectedLanguageCode = signal<DemoLanguage['code']>('en');
  readonly messageVersion = signal(1);
  readonly editCount = signal(0);
  readonly lastEdited = signal<string | null>(null);

  readonly selectedLanguage = computed(
    () =>
      this.languages.find((language) => language.code === this.selectedLanguageCode()) ??
      this.languages[0]
  );

  readonly greeting = computed(() => this.selectedLanguage().greeting);

  readonly baseTraceEvents: TraceEvent[] = [
    {
      time: '00.000',
      kind: 'actor',
      title: 'Alice → “Hi”',
      detail: 'Scripted actor sent semantic text action.',
      operation: 'ACTOR',
      status: 'sent',
      durationMs: 0,
      payload: {
        actor: { id: 'alice', mode: 'human' },
        message: { platform: 'telegram', chat_id: 894211, text: 'Hi' }
      },
      timings: [{ label: 'Dispatch', valueMs: 0 }]
    },
    {
      time: '00.008',
      kind: 'http',
      title: 'POST /telegram/webhook',
      detail: 'Update 4102 · HTTP 200 · 18 ms',
      operation: 'POST',
      status: '200 OK',
      durationMs: 18,
      payload: {
        update_id: 4102,
        message: {
          message_id: 26,
          from: { id: 894211, first_name: 'Alice', is_bot: false },
          chat: { id: 894211, type: 'private' },
          text: 'Hi'
        }
      },
      timings: [
        { label: 'Queue', valueMs: 1 },
        { label: 'Upload', valueMs: 2 },
        { label: 'Waiting', valueMs: 14 },
        { label: 'Download', valueMs: 1 }
      ]
    },
    {
      time: '00.041',
      kind: 'api',
      title: 'sendMessage',
      detail: 'Fake Bot API captured text + 4 actions.',
      operation: 'BOT API',
      status: 'captured',
      durationMs: 12,
      payload: {
        method: 'sendMessage',
        request: {
          chat_id: 894211,
          text: 'Howdy stranger! Choose a language for this conversation.',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'English', callback_data: 'lang:en' }, { text: 'Español', callback_data: 'lang:es' }],
              [{ text: 'Українська', callback_data: 'lang:uk' }, { text: 'Français', callback_data: 'lang:fr' }]
            ]
          }
        },
        response: { ok: true, result: { message_id: 27, chat: { id: 894211 } } }
      },
      timings: [
        { label: 'Queue', valueMs: 2 },
        { label: 'Adapter', valueMs: 4 },
        { label: 'Fixture', valueMs: 6 }
      ]
    },
    {
      time: '00.049',
      kind: 'assertion',
      title: 'Greeting matched',
      detail: 'Within 1 s · observed 49 ms',
      operation: 'ASSERT',
      status: 'passed',
      durationMs: 49,
      payload: {
        assertion: 'message.text contains greeting',
        expected: { within_ms: 1000, text: 'Howdy stranger!' },
        actual: { observed_ms: 49, message_id: 27, matched: true }
      },
      timings: [
        { label: 'Observe', valueMs: 41 },
        { label: 'Compare', valueMs: 8 }
      ]
    }
  ];

  readonly whatsappTraceEvents: TraceEvent[] = [
    {
      time: '00.000',
      kind: 'actor',
      title: 'Bob → “Anything due this week?”',
      detail: 'Human actor sent a WhatsApp text message.',
      operation: 'ACTOR',
      status: 'sent',
      durationMs: 0,
      payload: {
        actor: { id: 'bob', mode: 'human' },
        message: { platform: 'whatsapp', wa_id: '353860001227', text: 'Anything due this week?' }
      },
      timings: [{ label: 'Dispatch', valueMs: 0 }]
    },
    {
      time: '00.012',
      kind: 'http',
      title: 'POST /whatsapp/webhook',
      detail: 'Cloud API webhook · HTTP 200 · 24 ms',
      operation: 'POST',
      status: '200 OK',
      durationMs: 24,
      payload: {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'waba-1042',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              contacts: [{ wa_id: '353860001227', profile: { name: 'Bob' } }],
              messages: [{ id: 'wamid.in.1042', from: '353860001227', type: 'text', text: { body: 'Anything due this week?' } }]
            }
          }]
        }]
      },
      timings: [
        { label: 'Queue', valueMs: 2 },
        { label: 'Upload', valueMs: 3 },
        { label: 'Waiting', valueMs: 17 },
        { label: 'Download', valueMs: 2 }
      ]
    },
    {
      time: '00.069',
      kind: 'api',
      title: 'messages.create',
      detail: 'Fake Cloud API captured text + 2 replies.',
      operation: 'CLOUD API',
      status: 'captured',
      durationMs: 12,
      payload: {
        method: 'POST',
        path: '/v22.0/104255/messages',
        request: {
          messaging_product: 'whatsapp',
          to: '353860001227',
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: 'Your car insurance renews in 6 days.' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'open-renewal', title: 'Open renewal' } },
                { type: 'reply', reply: { id: 'remind-tomorrow', title: 'Remind me tomorrow' } }
              ]
            }
          }
        },
        response: { messaging_product: 'whatsapp', contacts: [{ wa_id: '353860001227' }], messages: [{ id: 'wamid.out.1043' }] }
      },
      timings: [
        { label: 'Queue', valueMs: 2 },
        { label: 'Adapter', valueMs: 4 },
        { label: 'Fixture', valueMs: 6 }
      ]
    },
    {
      time: '00.081',
      kind: 'assertion',
      title: 'Reminder matched',
      detail: 'Within 1 s · observed 81 ms',
      operation: 'ASSERT',
      status: 'passed',
      durationMs: 81,
      payload: {
        assertion: 'message.text contains renewal reminder',
        expected: { within_ms: 1000, text: 'renews in 6 days' },
        actual: { observed_ms: 81, message_id: 'wamid.out.1043', matched: true }
      },
      timings: [
        { label: 'Observe', valueMs: 73 },
        { label: 'Compare', valueMs: 8 }
      ]
    }
  ];

  readonly traceEvents = computed<TraceEvent[]>(() => {
    const language = this.selectedLanguage();
    const edited = this.messageVersion() > 1;
    if (!edited) {
      return this.baseTraceEvents;
    }
    return [
      ...this.baseTraceEvents,
      {
        time: '03.284',
        kind: 'actor',
        title: `Alice → ${language.label}`,
        detail: `Action ${language.callbackID}`,
        operation: 'CALLBACK',
        status: 'sent',
        durationMs: 0,
        payload: {
          actor: { id: 'alice', mode: 'human' },
          callback_query: { message_id: 27, data: language.callbackID }
        },
        timings: [{ label: 'Dispatch', valueMs: 0 }]
      },
      {
        time: '03.301',
        kind: 'http',
        title: 'POST /telegram/webhook',
        detail: 'Callback query 4103 · HTTP 200',
        operation: 'POST',
        status: '200 OK',
        durationMs: 18,
        payload: {
          update_id: 4103,
          callback_query: {
            id: 'cq-4103',
            from: { id: 894211, first_name: 'Alice' },
            data: language.callbackID,
            message: { message_id: 27, chat: { id: 894211, type: 'private' } }
          }
        },
        timings: [
          { label: 'Queue', valueMs: 1 },
          { label: 'Upload', valueMs: 2 },
          { label: 'Waiting', valueMs: 13 },
          { label: 'Download', valueMs: 2 }
        ]
      },
      {
        time: '03.337',
        kind: 'api',
        title: 'editMessageText',
        detail: `Message 27 · ${language.shortLabel} · version ${this.messageVersion()}`,
        operation: 'BOT API',
        status: 'captured',
        durationMs: 12,
        payload: {
          method: 'editMessageText',
          request: {
            chat_id: 894211,
            message_id: 27,
            text: language.greeting,
            reply_markup: {
              inline_keyboard: this.languages.map((item, index, items) =>
                index % 2 === 0
                  ? items.slice(index, index + 2).map((option) => ({
                      text: option.label,
                      callback_data: option.callbackID
                    }))
                  : null
              ).filter((row) => row !== null)
            }
          },
          response: { ok: true, result: { message_id: 27, version: this.messageVersion() } }
        },
        timings: [
          { label: 'Queue', valueMs: 2 },
          { label: 'Adapter', valueMs: 5 },
          { label: 'Fixture', valueMs: 5 }
        ],
        active: true
      },
      {
        time: '03.342',
        kind: 'assertion',
        title: 'In-place edit matched',
        detail: 'Same message ID · 58 ms · passed',
        operation: 'ASSERT',
        status: 'passed',
        durationMs: 58,
        payload: {
          assertion: 'message edited in place',
          expected: { message_id: 27, language: language.code },
          actual: { message_id: 27, version: this.messageVersion(), matched: true }
        },
        timings: [
          { label: 'Observe', valueMs: 52 },
          { label: 'Compare', valueMs: 6 }
        ],
        active: true
      }
    ];
  });

  translateGreeting(code: DemoLanguage['code']): void {
    if (code === this.selectedLanguageCode()) {
      return;
    }
    this.selectedLanguageCode.set(code);
    this.messageVersion.update((version) => version + 1);
    this.editCount.update((count) => count + 1);
    this.lastEdited.set('just now');
  }

  toggleTheme(): void {
    this.appTheme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }

  resetRun(): void {
    this.selectedLanguageCode.set('en');
    this.messageVersion.set(1);
    this.editCount.set(0);
    this.lastEdited.set(null);
  }
}

/** `matchMedia` fallback for `DemoStore.appTheme`'s initial value — see that field's doc comment. */
function initialAppTheme(): 'light' | 'dark' {
  if (typeof matchMedia !== 'function') {
    return 'light';
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
