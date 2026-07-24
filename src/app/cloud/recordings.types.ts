/**
 * Wire types mirroring `github.com/sneat-co/chatwright`'s
 * `recordings/dto4recordings` and `quota` packages exactly — see
 * chatwright/cloud's `recordings/handlers.go` (response shapes) and
 * `quota/quota.go` + `quota/http.go` (the `"quota"` block and the 402
 * `limit_reached` body). Kept as a dedicated file so `recordings.service.ts`
 * stays about behaviour, not shape.
 */

/** `dto4recordings.RecordingSummary` — metadata only, no bundle body. */
export interface RecordingSummary {
  id: string;
  title: string;
  format: string;
  platform?: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
}

/**
 * `quota.Metadata` — the sell-at-the-limit-pattern quiet counter block every
 * quota-gated response carries on success. `limit` is `-1` (`plans
 * .Unlimited`) for a plan/feature with no cap — see `formatQuotaCounter`.
 */
export interface QuotaMetadata {
  feature: string;
  used: number;
  limit: number;
  plan: string;
}

/** The sentinel `quota.Metadata.limit` value meaning "no cap" — `plans.Unlimited` in chatwright/cloud. */
export const QUOTA_UNLIMITED = -1;

/** `quota.LimitError.Body()` — the HTTP 402 `limit_reached` wire shape. */
export interface LimitReachedBody {
  code: 'limit_reached';
  feature: string;
  used: number;
  limit: number;
  plan: string;
  upgradeUrl: string;
}

/** The generic `{error, message}` body every non-402 error response carries — see `writeError` in handlers.go. */
export interface ApiErrorBody {
  error: string;
  message: string;
}

/** POST save-recording's 201 response body. */
export interface SaveRecordingResponse {
  spaceID: string;
  recording: RecordingSummary;
  quota?: QuotaMetadata;
}

/** GET list-recordings's 200 response body. */
export interface ListRecordingsResponse {
  recordings: RecordingSummary[];
  quota?: QuotaMetadata;
}

/** GET get-recording's 200 response body — `bundle` is the opaque run-bundle document, verbatim. */
export interface GetRecordingResponse {
  id: string;
  spaceID: string;
  title: string;
  format: string;
  platform?: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  bundle: unknown;
}

/**
 * Every `RecordingsService` call returns this discriminated union instead of
 * throwing — a thin service, a thin component: callers `switch` on `kind`
 * rather than wrapping every call in try/catch.
 */
export type RecordingsResult<T> =
  | { ok: true; data: T }
  /** No Firebase ID token — sign in first. Never even reaches the network. */
  | { ok: false; kind: 'unauthenticated' }
  /** The 402 `limit_reached` gate — render the sell-at-the-limit panel. */
  | { ok: false; kind: 'limit_reached'; body: LimitReachedBody }
  /**
   * `listRecordings()`/`getRecording()` called with no `spaceID` and none
   * remembered yet (see `RecordingsService`'s doc comment on the
   * personal-space-id gap) — never reaches the network either.
   */
  | { ok: false; kind: 'unknown_space' }
  /** Any other non-2xx response, or a network/parse failure. */
  | { ok: false; kind: 'error'; status: number; message: string };
