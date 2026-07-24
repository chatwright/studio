import { Injectable, signal } from '@angular/core';

import { AuthService } from './auth.service';
import { RECORDINGS_API } from './api.config';
import {
  ApiErrorBody,
  GetRecordingResponse,
  LimitReachedBody,
  ListRecordingsResponse,
  RecordingsResult,
  SaveRecordingResponse
} from './recordings.types';

/**
 * Chatwright Cloud's `/v0/api4chatwright/*` client: save the currently
 * loaded run bundle into the caller's personal space, and list/read it back.
 * All three methods return a `RecordingsResult` (never throw) — see
 * `recordings.types.ts`'s doc comment.
 *
 * ### The personal-space-id gap
 *
 * `save-recording` resolves the caller's personal space **server-side**
 * (`personalSpaceAdapter` in sneat-go's `pkg/modules/chatwright/adapters.go`)
 * and returns its id in the response body — but `list-recordings` and
 * `get-recording` both **require** `spaceID` as a query param (see
 * chatwright/cloud's `recordings/handlers.go`); neither endpoint resolves
 * "my personal space" on its own. There is today no endpoint a fresh
 * browser session can call to learn its personal space id before ever
 * saving a recording — so a signed-in visitor who saved recordings from a
 * *different* browser/device cannot list them here until an equivalent
 * endpoint exists. Filed upstream rather than worked around; see this PR's
 * body / chatwright/cloud issue tracker.
 *
 * This service works around the gap the only honest way available: it
 * remembers the last `spaceID` a save/list response revealed, per signed-in
 * `uid`, in `localStorage` (`STORAGE_KEY_PREFIX`). `listRecordings()`/
 * `getRecording()` called with no explicit `spaceID` use that remembered
 * value; if none is remembered yet, they return `{ ok: false, kind:
 * 'unknown_space' }` WITHOUT making a network call — the My recordings page
 * renders that as an explanatory empty state (see `recordings.page.ts`),
 * never a raw 400 from the API.
 */
@Injectable({ providedIn: 'root' })
export class RecordingsService {
  /** The last personal `spaceID` this browser has seen for the signed-in user — `null` until a save/list reveals one. Mirrors `localStorage`; see `knownSpaceID`/`rememberSpaceID`. */
  readonly spaceID = signal<string | null>(null);

  constructor(private readonly auth: AuthService) {}

  /**
   * Saves `bundleJsonText` (the exact bytes of a `*.chatwright.json` file —
   * NOT a re-serialised parsed object, so any field this app's `Bundle`
   * model does not know about round-trips byte-for-byte) into the caller's
   * personal space.
   */
  async saveRecording(bundleJsonText: string): Promise<RecordingsResult<SaveRecordingResponse>> {
    const token = await this.auth.getIdToken();
    if (!token) {
      return { ok: false, kind: 'unauthenticated' };
    }

    const result = await this.request<SaveRecordingResponse>(RECORDINGS_API.save, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: bundleJsonText
    });

    if (result.ok) {
      this.rememberSpaceID(result.data.spaceID);
    }
    return result;
  }

  /** Lists the signed-in user's saved recordings. `spaceID` defaults to `knownSpaceID()` — see this class's doc comment. */
  async listRecordings(spaceID = this.knownSpaceID()): Promise<RecordingsResult<ListRecordingsResponse>> {
    const token = await this.auth.getIdToken();
    if (!token) {
      return { ok: false, kind: 'unauthenticated' };
    }
    if (!spaceID) {
      return { ok: false, kind: 'unknown_space' };
    }

    const result = await this.request<ListRecordingsResponse>(
      `${RECORDINGS_API.list}?spaceID=${encodeURIComponent(spaceID)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (result.ok) {
      this.rememberSpaceID(spaceID);
    }
    return result;
  }

  /** Reads one recording's full bundle. `spaceID` defaults to `knownSpaceID()` like `listRecordings`. */
  async getRecording(id: string, spaceID = this.knownSpaceID()): Promise<RecordingsResult<GetRecordingResponse>> {
    const token = await this.auth.getIdToken();
    if (!token) {
      return { ok: false, kind: 'unauthenticated' };
    }
    if (!spaceID) {
      return { ok: false, kind: 'unknown_space' };
    }

    return this.request<GetRecordingResponse>(
      `${RECORDINGS_API.get}?spaceID=${encodeURIComponent(spaceID)}&id=${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** The remembered personal `spaceID` for the currently signed-in user, if any — see this class's doc comment. */
  knownSpaceID(): string | null {
    const cached = this.spaceID();
    if (cached) {
      return cached;
    }
    const uid = this.currentUID();
    if (!uid) {
      return null;
    }
    const stored = readStorage(storageKey(uid));
    if (stored) {
      this.spaceID.set(stored);
    }
    return stored;
  }

  private rememberSpaceID(spaceID: string): void {
    this.spaceID.set(spaceID);
    const uid = this.currentUID();
    if (uid) {
      writeStorage(storageKey(uid), spaceID);
    }
  }

  private currentUID(): string | null {
    return this.auth.account()?.uid ?? null;
  }

  private async request<T>(url: string, init: RequestInit): Promise<RecordingsResult<T>> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      return { ok: false, kind: 'error', status: 0, message: networkErrorMessage(error) };
    }

    if (response.status === 402) {
      const body = await safeJson<LimitReachedBody>(response);
      if (body) {
        return { ok: false, kind: 'limit_reached', body };
      }
      return { ok: false, kind: 'error', status: 402, message: 'Recording limit reached.' };
    }

    if (response.status === 401) {
      return { ok: false, kind: 'unauthenticated' };
    }

    if (!response.ok) {
      const body = await safeJson<ApiErrorBody>(response);
      return {
        ok: false,
        kind: 'error',
        status: response.status,
        message: body?.message || `Request failed (${response.status})`
      };
    }

    const data = await safeJson<T>(response);
    if (data === null) {
      return { ok: false, kind: 'error', status: response.status, message: 'The server returned an empty response.' };
    }
    return { ok: true, data };
  }
}

const STORAGE_KEY_PREFIX = 'chatwright.cloud.spaceID.';

function storageKey(uid: string): string {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

/** Guards every `localStorage` touch — `undefined` under SSR/Vitest's plain Node test environment (see vitest.config.ts). */
function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    // Some browsers throw on localStorage access in a locked-down context (e.g. an embedding iframe) — treat as unavailable.
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Best-effort only — an in-session `spaceID` signal still works this page load.
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function networkErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Network error — please try again.';
}
