/**
 * Chatwright Cloud's API host — the sneat-go Cloud Run service, deployed at
 * `api.sneat.cloud` (see `pkg/modules/chatwright` in sneat-go, which mounts
 * `github.com/sneat-co/chatwright`'s `recordings` package under
 * `/v0/api4chatwright/`). CORS for the `chatwright.dev` origin is enabled
 * server-side by sneat-go PR #866 — until that deploys, calls from
 * `chatwright.dev` (and `localhost` during `ng serve`/`wrangler dev`) fail
 * at the browser's CORS check, not at this constant.
 */
export const API_BASE_URL = 'https://api.sneat.cloud';

/** `/v0/api4chatwright/*` endpoints — see chatwright/cloud's recordings.Handler.Register. */
export const RECORDINGS_API = {
  save: `${API_BASE_URL}/v0/api4chatwright/save-recording`,
  list: `${API_BASE_URL}/v0/api4chatwright/list-recordings`,
  get: `${API_BASE_URL}/v0/api4chatwright/get-recording`
} as const;
