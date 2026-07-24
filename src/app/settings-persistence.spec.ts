import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SERVER_ADDRESS,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  saveSettings,
  type StorageLike
} from './settings-persistence';

/** A hand-rolled in-memory `StorageLike` — no real `localStorage`/DOM needed, matching this repo's framework-free pure-logic test idiom. */
function fakeStorage(seed?: Record<string, string>): StorageLike {
  const backing = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => void backing.set(key, value)
  };
}

describe('loadSettings', () => {
  it('returns DEFAULT_SETTINGS when nothing is stored', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('returns DEFAULT_SETTINGS for invalid JSON, never throwing', () => {
    const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: '{not json' });
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns DEFAULT_SETTINGS for a JSON value that is not an object', () => {
    const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: '[1,2,3]' });
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a full snapshot written by saveSettings', () => {
    const storage = fakeStorage();
    const snapshot = {
      providerMode: 'local' as const,
      byok: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-test' },
      local: { model: 'qwen2.5' },
      serverAddress: 'http://127.0.0.1:5000'
    };
    saveSettings(storage, snapshot);
    expect(loadSettings(storage)).toEqual(snapshot);
  });

  it('falls back per-field when providerMode is not one of the known modes', () => {
    const storage = fakeStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ providerMode: 'quantum', byok: { baseURL: 'x', model: 'y', apiKey: 'z' } })
    });
    const loaded = loadSettings(storage);
    expect(loaded.providerMode).toBe(DEFAULT_SETTINGS.providerMode);
    expect(loaded.byok).toEqual({ baseURL: 'x', model: 'y', apiKey: 'z' });
  });

  it('falls back per-field when byok is missing or malformed, without discarding other fields', () => {
    const storage = fakeStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ providerMode: 'byok', byok: 'not-an-object', serverAddress: 'http://x' })
    });
    const loaded = loadSettings(storage);
    expect(loaded.providerMode).toBe('byok');
    expect(loaded.byok).toEqual(DEFAULT_SETTINGS.byok);
    expect(loaded.serverAddress).toBe('http://x');
  });

  it('falls back to the default server address when serverAddress is blank', () => {
    const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ serverAddress: '   ' }) });
    expect(loadSettings(storage).serverAddress).toBe(DEFAULT_SERVER_ADDRESS);
  });

  it('a getItem/setItem that throws (e.g. storage disabled) degrades to defaults/no-op rather than throwing', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      }
    };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(throwing, DEFAULT_SETTINGS)).not.toThrow();
  });
});
