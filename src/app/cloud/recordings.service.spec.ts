import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService, SneatAccount } from './auth.service';
import { RECORDINGS_API } from './api.config';
import { RecordingsService } from './recordings.service';
import { GetRecordingResponse, ListRecordingsResponse, SaveRecordingResponse } from './recordings.types';

/** A minimal in-memory `Storage` — Vitest's plain Node test environment (vitest.config.ts) has no real `localStorage`. */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function testAccount(uid: string): SneatAccount {
  return { uid, displayName: 'Test user', email: null, photoURL: null, initials: 'TU' };
}

/**
 * A duck-typed `AuthService` stand-in — only `account`/`getIdToken` are read
 * by `RecordingsService`. `account` is backed by a REAL Angular `signal()`
 * (not a plain closure) so it behaves exactly like the production
 * `AuthService.account` for `RecordingsService`'s `computed(spaceID)` —
 * `computed()` only invalidates on genuine tracked-signal reads, so a plain
 * function standing in for `account` would silently never re-evaluate,
 * masking the very bug `setUid` exists to reproduce. `setUid` lets a test
 * simulate an in-tab account switch (sign out + sign in as someone else)
 * against the SAME `RecordingsService` instance — what actually happens in
 * the app, since it's a `providedIn: 'root'` singleton.
 */
function fakeAuth(uid: string | null, token: string | null): AuthService & { setUid(uid: string | null): void } {
  const account = signal<SneatAccount | null>(uid ? testAccount(uid) : null);
  return {
    account,
    getIdToken: async () => token,
    setUid: (nextUid: string | null) => {
      account.set(nextUid ? testAccount(nextUid) : null);
    }
  } as unknown as AuthService & { setUid(uid: string | null): void };
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('RecordingsService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveRecording', () => {
    it('returns unauthenticated without calling fetch when there is no ID token', async () => {
      const service = new RecordingsService(fakeAuth('u1', null));
      const result = await service.saveRecording('{"format":"x"}');
      expect(result).toEqual({ ok: false, kind: 'unauthenticated' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POSTs the raw bundle text with a Bearer header and parses the 201 response', async () => {
      const responseBody: SaveRecordingResponse = {
        spaceID: 'space-1',
        recording: { id: 'rec-1', title: 'Untitled recording', format: 'fmt', sizeBytes: 42, createdAt: '2026-07-24T00:00:00Z', createdBy: 'u1' },
        quota: { feature: 'recordings.saved', used: 2, limit: 10, plan: 'free' }
      };
      fetchMock.mockResolvedValue(jsonResponse(201, responseBody));

      const service = new RecordingsService(fakeAuth('u1', 'id-token-abc'));
      const bundleText = '{"format":"https://chatwright.dev/formats/run-bundle/v1"}';
      const result = await service.saveRecording(bundleText);

      expect(fetchMock).toHaveBeenCalledWith(
        RECORDINGS_API.save,
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer id-token-abc', 'Content-Type': 'application/json' },
          body: bundleText
        })
      );
      expect(result).toEqual({ ok: true, data: responseBody });
      // The save reveals spaceID — the service remembers it for future list/get calls.
      expect(service.spaceID()).toBe('space-1');
      expect(localStorage.getItem('chatwright.cloud.spaceID.u1')).toBe('space-1');
    });

    it('maps a 402 to the limit_reached result kind, carrying the wire body verbatim', async () => {
      const limitBody = {
        code: 'limit_reached' as const,
        feature: 'recordings.saved',
        used: 10,
        limit: 10,
        plan: 'free',
        upgradeUrl: 'https://chatwright.dev/pricing'
      };
      fetchMock.mockResolvedValue(jsonResponse(402, limitBody));

      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.saveRecording('{}');

      expect(result).toEqual({ ok: false, kind: 'limit_reached', body: limitBody });
    });

    it('maps a 401 to unauthenticated', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: 'unauthenticated', message: 'sign in' }));
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.saveRecording('{}');
      expect(result).toEqual({ ok: false, kind: 'unauthenticated' });
    });

    it('maps any other non-2xx status to a generic error carrying the body message', async () => {
      fetchMock.mockResolvedValue(jsonResponse(413, { error: 'too_large', message: 'recording exceeds the upload limit' }));
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.saveRecording('{}');
      expect(result).toEqual({ ok: false, kind: 'error', status: 413, message: 'recording exceeds the upload limit' });
    });

    it('maps a network failure to a status-0 error, never throwing', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.saveRecording('{}');
      expect(result).toEqual({ ok: false, kind: 'error', status: 0, message: 'offline' });
    });
  });

  describe('listRecordings', () => {
    it('returns unknown_space without calling fetch when no spaceID is known', async () => {
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.listRecordings();
      expect(result).toEqual({ ok: false, kind: 'unknown_space' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uses a spaceID remembered from localStorage across a fresh service instance', async () => {
      localStorage.setItem('chatwright.cloud.spaceID.u1', 'space-9');
      const responseBody: ListRecordingsResponse = { recordings: [], quota: { feature: 'recordings.saved', used: 0, limit: 10, plan: 'free' } };
      fetchMock.mockResolvedValue(jsonResponse(200, responseBody));

      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.listRecordings();

      expect(fetchMock).toHaveBeenCalledWith(
        `${RECORDINGS_API.list}?spaceID=space-9`,
        expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
      );
      expect(result).toEqual({ ok: true, data: responseBody });
    });

    it('accepts an explicit spaceID override', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { recordings: [] }));
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      await service.listRecordings('space-explicit');
      expect(fetchMock).toHaveBeenCalledWith(`${RECORDINGS_API.list}?spaceID=space-explicit`, expect.anything());
    });

    it('returns unauthenticated without calling fetch when there is no ID token, even with a known spaceID', async () => {
      localStorage.setItem('chatwright.cloud.spaceID.u1', 'space-9');
      const service = new RecordingsService(fakeAuth('u1', null));
      const result = await service.listRecordings();
      expect(result).toEqual({ ok: false, kind: 'unauthenticated' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getRecording', () => {
    it('returns unknown_space without calling fetch when no spaceID is known', async () => {
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.getRecording('rec-1');
      expect(result).toEqual({ ok: false, kind: 'unknown_space' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetches the full bundle for an explicit spaceID + id', async () => {
      const responseBody: GetRecordingResponse = {
        id: 'rec-1',
        spaceID: 'space-1',
        title: 'A run',
        format: 'https://chatwright.dev/formats/run-bundle/v1',
        sizeBytes: 12,
        createdAt: '2026-07-24T00:00:00Z',
        createdBy: 'u1',
        bundle: { format: 'https://chatwright.dev/formats/run-bundle/v1', runs: [] }
      };
      fetchMock.mockResolvedValue(jsonResponse(200, responseBody));

      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      const result = await service.getRecording('rec-1', 'space-1');

      expect(fetchMock).toHaveBeenCalledWith(
        `${RECORDINGS_API.get}?spaceID=space-1&id=rec-1`,
        expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
      );
      expect(result).toEqual({ ok: true, data: responseBody });
    });
  });

  describe('knownSpaceID', () => {
    it('is null with no signed-in user and nothing remembered', () => {
      const service = new RecordingsService(fakeAuth(null, null));
      expect(service.knownSpaceID()).toBeNull();
    });

    it('reads a previously remembered spaceID for the signed-in uid from localStorage', () => {
      localStorage.setItem('chatwright.cloud.spaceID.u1', 'space-42');
      const service = new RecordingsService(fakeAuth('u1', 'tok'));
      expect(service.knownSpaceID()).toBe('space-42');
      expect(service.spaceID()).toBe('space-42');
    });

    it('does not leak one user\'s remembered spaceID to another uid', () => {
      localStorage.setItem('chatwright.cloud.spaceID.u1', 'space-42');
      const service = new RecordingsService(fakeAuth('u2', 'tok'));
      expect(service.knownSpaceID()).toBeNull();
    });

    it('does not serve a stale spaceID after an in-tab account switch on the same service instance', () => {
      // RecordingsService is a `providedIn: 'root'` singleton — it outlives
      // any one sign-in, so the real bug only shows up when ONE instance
      // sees a sequence of different uids, not when each uid gets its own
      // fresh instance (that proves nothing about the cache surviving a
      // switch).
      localStorage.setItem('chatwright.cloud.spaceID.u1', 'space-42');
      const auth = fakeAuth('u1', 'tok');
      const service = new RecordingsService(auth);

      // u1 signs in first and the service caches u1's remembered spaceID.
      expect(service.knownSpaceID()).toBe('space-42');
      expect(service.spaceID()).toBe('space-42');

      // Same tab, same RecordingsService instance — u1 signs out and u2
      // signs in. u2 has never saved/listed anything, so nothing is
      // remembered for u2 in localStorage; u1's cached spaceID must NOT
      // leak through to u2.
      auth.setUid('u2');
      expect(service.spaceID()).toBeNull();
      expect(service.knownSpaceID()).toBeNull();

      // u1 signs back in within the same tab — their spaceID is still
      // legitimately known (both from the in-memory cache and localStorage).
      auth.setUid('u1');
      expect(service.knownSpaceID()).toBe('space-42');
    });
  });
});
