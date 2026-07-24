/**
 * Producing a configured `@chatwright/runtime` `Provider` for whichever mode
 * the "AI test" tab's provider-mode selector is set to — one abstraction the
 * run UI drives regardless of BYOK / Local AI / Cloud. Framework-free: only
 * the runtime's own `Provider`/`OpenAIProvider`, so it is cheaply unit-
 * testable with a hand-rolled fake `fetch`, same idiom as this app's other
 * pure-logic modules (`default-tab.ts`, `bubble-reducer.ts`).
 *
 * @remarks
 * **BYOK is zero-install and browser→provider only**: `buildByokProvider`
 * constructs an `OpenAIProvider` that fetches DIRECTLY from this browser to
 * whatever `baseURL` the visitor entered — the api key it carries is
 * whatever `SettingsStore` handed this function (itself sourced from
 * `localStorage`, see that store's own doc comment); it is never sent to any
 * Chatwright server, companion or otherwise.
 *
 * **Local AI** talks to the companion server's OpenAI-compatible proxy
 * (`{serverAddress}/v1/chat/completions`) instead — `detectLocalServer`
 * probes `{serverAddress}/health` first (the server's own contract) so the
 * "AI test" panel can honestly report the server present/absent before
 * ever trying to build a provider for it.
 *
 * **Cloud** is a fast-follow stub: `CloudPendingProvider` is a clearly-
 * labelled placeholder, never a real hosted backend — it throws if ever
 * actually asked to propose (the panel keeps Run disabled for this mode).
 */

import { OpenAIProvider, type FetchLike, type Prompt, type Provider, type ProposeResult } from '@chatwright/runtime';

import type { ByokSettings } from '../../../settings-persistence';

export type ProviderSourceResult = { readonly ok: true; readonly provider: Provider } | { readonly ok: false; readonly error: string };

/** `GET {serverAddress}/health`'s shape (the companion server's own contract) — only the fields this app reads. */
export interface ServerHealth {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export const DEFAULT_SERVER_ADDRESS = 'http://127.0.0.1:4319';

/** The subset of the global `fetch` signature `detectLocalServer` needs — trivial to fake in tests. */
export type DetectFetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

function normaliseBase(address: string): string {
  const trimmed = address.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_SERVER_ADDRESS;
}

/**
 * Probes `{serverAddress}/health` for a running `chatwright server`. Never
 * throws: any network failure, non-2xx response, or unexpected body shape
 * means "unavailable" — the companion server is an optional, detected
 * convenience, never assumed present.
 */
export async function detectLocalServer(fetchImpl: DetectFetch, serverAddress: string): Promise<ServerHealth | null> {
  const base = normaliseBase(serverAddress);
  try {
    const response = await fetchImpl(`${base}/health`);
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const record = body as Record<string, unknown>;
    if (typeof record['name'] !== 'string') {
      return null;
    }
    return {
      name: record['name'],
      version: typeof record['version'] === 'string' ? record['version'] : '',
      capabilities: Array.isArray(record['capabilities'])
        ? record['capabilities'].filter((entry): entry is string => typeof entry === 'string')
        : []
    };
  } catch {
    return null;
  }
}

/**
 * Builds a BYOK `OpenAIProvider`. `fetchImpl` overrides the global `fetch`
 * (tests only; production leaves it unset, which is `OpenAIProvider`'s own
 * "fetch directly, browser→provider" default).
 */
export function buildByokProvider(settings: ByokSettings, fetchImpl?: FetchLike): ProviderSourceResult {
  const baseURL = settings.baseURL.trim();
  const model = settings.model.trim();
  if (!baseURL) {
    return { ok: false, error: 'Set a base URL for your OpenAI-compatible endpoint (e.g. https://api.openai.com/v1).' };
  }
  if (!model) {
    return { ok: false, error: 'Set a model id.' };
  }
  try {
    const apiKey = settings.apiKey.trim();
    return { ok: true, provider: new OpenAIProvider({ baseURL, model, apiKey: apiKey || undefined, fetch: fetchImpl }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Builds a Local-AI `OpenAIProvider` over the companion server's `/v1` proxy — call only once `detectLocalServer` has confirmed the server is present. */
export function buildLocalProvider(serverAddress: string, model: string, fetchImpl?: FetchLike): ProviderSourceResult {
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return { ok: false, error: 'Set a model id for the companion server to serve.' };
  }
  try {
    return {
      ok: true,
      provider: new OpenAIProvider({ baseURL: `${normaliseBase(serverAddress)}/v1`, model: trimmedModel, fetch: fetchImpl })
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cloud's fast-follow stub — see this module's doc comment. Never a real backend; throws honestly if ever asked to propose. */
export class CloudPendingProvider implements Provider {
  async propose(_prompt: Prompt): Promise<ProposeResult> {
    throw new Error('Cloud is coming soon (quota-based hosted inference) — use BYOK or Local AI for now.');
  }
}

/** The distinguishing message a run stopped via `withStopSignal` carries — lets a caller tell "the user pressed Stop" apart from any other provider failure. */
export const RUN_STOPPED_BY_USER = 'ai-test: run stopped by user';

/**
 * Wraps `inner` so every `propose()` call first checks `shouldStop()` — the
 * actor loop's own per-iteration `provider.propose` call
 * (`@chatwright/runtime`'s `Loop.runTask`) is the only seam this engine
 * exposes for cooperative cancellation. A `true` result throws before
 * `inner` is ever asked for anything further — for BYOK/Local this means
 * before the next network request fires, typically within one loop
 * iteration of the visitor pressing Stop.
 */
export function withStopSignal(inner: Provider, shouldStop: () => boolean): Provider {
  return {
    async propose(prompt: Prompt): Promise<ProposeResult> {
      if (shouldStop()) {
        throw new Error(RUN_STOPPED_BY_USER);
      }
      return inner.propose(prompt);
    }
  };
}
