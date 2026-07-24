/**
 * Pure, framework-free persistence logic for `SettingsStore` (settings.store.ts)
 * — the app's first PERSISTED state (every other store, `DemoStore`, is
 * in-memory only). Kept independent of `localStorage`/`Storage` directly —
 * `StorageLike` below is the minimal surface this module needs, which a real
 * `localStorage` satisfies structurally and a hand-rolled in-memory fake
 * satisfies just as well in tests — same "declare, don't assume" idiom as
 * this app's other pure-logic modules (`pages/playground/default-tab.ts`'s
 * `resolveInitialTab`).
 */

/** The "AI test" provider-mode selector's three options (see spec/ideas/studio-ui-surfaces.md and this feature's own spec note). */
export type SettingsProviderMode = 'byok' | 'local' | 'cloud';

/** BYOK: fetches directly browser→provider; the API key is stored ONLY here (client-side) and is never sent to any Chatwright server. */
export interface ByokSettings {
  readonly baseURL: string;
  readonly model: string;
  readonly apiKey: string;
}

/** Local AI: which model the companion server (`chatwright server`) should proxy to — the server address itself is `SettingsSnapshot.serverAddress`, shared with any other companion-server use. */
export interface LocalAiSettings {
  readonly model: string;
}

export interface SettingsSnapshot {
  readonly providerMode: SettingsProviderMode;
  readonly byok: ByokSettings;
  readonly local: LocalAiSettings;
  readonly serverAddress: string;
}

/** The companion server's default address (see `chatwright server`'s own contract: `GET {this}/health`). */
export const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:4319';

export const DEFAULT_SETTINGS: SettingsSnapshot = {
  providerMode: 'byok',
  byok: { baseURL: '', model: '', apiKey: '' },
  local: { model: '' },
  serverAddress: DEFAULT_SERVER_ADDRESS
};

/** Versioned so a future incompatible shape change can detect and migrate/discard an old entry rather than silently misreading it. */
export const SETTINGS_STORAGE_KEY = 'chatwright-studio:settings:v1';

/** The minimal `Storage` surface this module needs — a real `localStorage` satisfies it structurally; tests pass a hand-rolled in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reads and validates a persisted settings snapshot from `storage`. Never
 * throws: a missing key, invalid JSON, or any individual field shaped wrong
 * falls back to `DEFAULT_SETTINGS` for that field alone (per-field, not
 * all-or-nothing) — a corrupt/partial `localStorage` entry degrades
 * gracefully rather than losing every other setting.
 */
export function loadSettings(storage: StorageLike): SettingsSnapshot {
  const raw = safeGetItem(storage);
  if (raw === null) {
    return DEFAULT_SETTINGS;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_SETTINGS;
  }
  const record = parsed as Record<string, unknown>;

  return {
    providerMode: isProviderMode(record['providerMode']) ? record['providerMode'] : DEFAULT_SETTINGS.providerMode,
    byok: readByok(record['byok']),
    local: readLocal(record['local']),
    serverAddress: readNonEmptyString(record['serverAddress'], DEFAULT_SETTINGS.serverAddress)
  };
}

/**
 * Persists `snapshot` to `storage`. Swallows a write failure (private-
 * browsing quota, disabled storage) — persistence is a convenience, never a
 * hard requirement for the rest of the app to keep working.
 */
export function saveSettings(storage: StorageLike, snapshot: SettingsSnapshot): void {
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore — see doc comment.
  }
}

function safeGetItem(storage: StorageLike): string | null {
  try {
    return storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function isProviderMode(value: unknown): value is SettingsProviderMode {
  return value === 'byok' || value === 'local' || value === 'cloud';
}

function readByok(value: unknown): ByokSettings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS.byok;
  }
  const record = value as Record<string, unknown>;
  return {
    baseURL: readString(record['baseURL'], DEFAULT_SETTINGS.byok.baseURL),
    model: readString(record['model'], DEFAULT_SETTINGS.byok.model),
    apiKey: readString(record['apiKey'], DEFAULT_SETTINGS.byok.apiKey)
  };
}

function readLocal(value: unknown): LocalAiSettings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS.local;
  }
  const record = value as Record<string, unknown>;
  return { model: readString(record['model'], DEFAULT_SETTINGS.local.model) };
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}
