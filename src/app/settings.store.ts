import { Injectable, effect, signal } from '@angular/core';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ByokSettings,
  type LocalAiSettings,
  type SettingsProviderMode,
  type StorageLike
} from './settings-persistence';

/**
 * The app's first PERSISTED state (every other store — `DemoStore` above —
 * is in-memory only, reset on reload). Backs the Playground's "AI test" tab
 * (`pages/playground/ai-test/`): which provider mode is selected (BYOK /
 * Local AI / Cloud), the BYOK `{baseURL, model, apiKey}` triple, the Local AI
 * model id, and a companion-server address override. Persists to
 * `localStorage` via one `effect()` that fires on every signal change — the
 * actual read/write/validation logic lives in the framework-free
 * `settings-persistence.ts` (unit-tested there with a hand-rolled fake
 * `Storage`; this class is Angular glue over it, untested directly, the
 * same posture this app already takes with `DemoStore`/`ChatPaneComponent`).
 *
 * @remarks
 * **The BYOK API key never leaves this browser**: it is read from and
 * written to `localStorage` only, by this store, and handed to
 * `OpenAIProvider`'s config only at the point of constructing that provider
 * (`pages/playground/ai-test/provider-source.ts`) — which then fetches
 * DIRECTLY browser→provider. No Chatwright server (companion or otherwise)
 * ever sees it.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = safeLocalStorage();
  private readonly initial = loadSettings(this.storage);

  readonly providerMode = signal<SettingsProviderMode>(this.initial.providerMode);
  readonly byokBaseURL = signal(this.initial.byok.baseURL);
  readonly byokModel = signal(this.initial.byok.model);
  readonly byokApiKey = signal(this.initial.byok.apiKey);
  readonly localModel = signal(this.initial.local.model);
  readonly serverAddress = signal(this.initial.serverAddress);

  constructor() {
    effect(() => {
      saveSettings(this.storage, {
        providerMode: this.providerMode(),
        byok: { baseURL: this.byokBaseURL(), model: this.byokModel(), apiKey: this.byokApiKey() },
        local: { model: this.localModel() },
        serverAddress: this.serverAddress()
      });
    });
  }

  setProviderMode(mode: SettingsProviderMode): void {
    this.providerMode.set(mode);
  }

  setByok(patch: Partial<ByokSettings>): void {
    if (patch.baseURL !== undefined) this.byokBaseURL.set(patch.baseURL);
    if (patch.model !== undefined) this.byokModel.set(patch.model);
    if (patch.apiKey !== undefined) this.byokApiKey.set(patch.apiKey);
  }

  setLocal(patch: Partial<LocalAiSettings>): void {
    if (patch.model !== undefined) this.localModel.set(patch.model);
  }

  setServerAddress(address: string): void {
    this.serverAddress.set(address.trim() || DEFAULT_SETTINGS.serverAddress);
  }
}

/**
 * `localStorage` is unavailable in SSR/non-browser environments — guarded
 * rather than assumed, same "declare, don't assume" idiom as
 * `DemoStore.initialAppTheme()` — and falls back to an in-memory
 * `StorageLike` so the store still functions, just without persistence
 * across reloads, in that case.
 */
function safeLocalStorage(): StorageLike {
  if (typeof localStorage === 'undefined') {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value)
    };
  }
  return localStorage;
}
