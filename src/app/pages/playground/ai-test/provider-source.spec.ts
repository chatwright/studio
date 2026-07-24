import { OpenAIProvider } from '@chatwright/runtime';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SERVER_ADDRESS,
  RUN_STOPPED_BY_USER,
  buildByokProvider,
  buildLocalProvider,
  detectLocalServer,
  withStopSignal,
  type DetectFetch
} from './provider-source';

describe('detectLocalServer', () => {
  it('reports the server available when /health responds 2xx with a name', async () => {
    const fetchImpl: DetectFetch = async (url) => {
      expect(url).toBe('http://127.0.0.1:4319/health');
      return { ok: true, json: async () => ({ name: 'chatwright-server', version: '0.4.0', capabilities: ['ai-proxy', 'datastate'] }) };
    };
    const health = await detectLocalServer(fetchImpl, DEFAULT_SERVER_ADDRESS);
    expect(health).toEqual({ name: 'chatwright-server', version: '0.4.0', capabilities: ['ai-proxy', 'datastate'] });
  });

  it('trims a trailing slash and normalises a blank address to the default', async () => {
    const seen: string[] = [];
    const fetchImpl: DetectFetch = async (url) => {
      seen.push(url);
      return { ok: true, json: async () => ({ name: 'chatwright-server' }) };
    };
    await detectLocalServer(fetchImpl, 'http://127.0.0.1:4319/');
    await detectLocalServer(fetchImpl, '   ');
    expect(seen).toEqual(['http://127.0.0.1:4319/health', 'http://127.0.0.1:4319/health']);
  });

  it('reports unavailable (never throws) when fetch rejects — no server listening', async () => {
    const fetchImpl: DetectFetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    await expect(detectLocalServer(fetchImpl, DEFAULT_SERVER_ADDRESS)).resolves.toBeNull();
  });

  it('reports unavailable for a non-2xx response', async () => {
    const fetchImpl: DetectFetch = async () => ({ ok: false, json: async () => ({}) });
    expect(await detectLocalServer(fetchImpl, DEFAULT_SERVER_ADDRESS)).toBeNull();
  });

  it('reports unavailable for a 2xx body missing the expected shape', async () => {
    const fetchImpl: DetectFetch = async () => ({ ok: true, json: async () => ({ unexpected: true }) });
    expect(await detectLocalServer(fetchImpl, DEFAULT_SERVER_ADDRESS)).toBeNull();
  });
});

describe('buildByokProvider', () => {
  it('rejects a blank base URL', () => {
    const result = buildByokProvider({ baseURL: '  ', model: 'gpt-4o-mini', apiKey: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects a blank model', () => {
    const result = buildByokProvider({ baseURL: 'https://api.openai.com/v1', model: ' ', apiKey: '' });
    expect(result.ok).toBe(false);
  });

  it('builds a real OpenAIProvider once baseURL and model are set, api key optional', () => {
    const result = buildByokProvider({ baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBeInstanceOf(OpenAIProvider);
    }
  });
});

describe('buildLocalProvider', () => {
  it('rejects a blank model', () => {
    expect(buildLocalProvider(DEFAULT_SERVER_ADDRESS, '  ').ok).toBe(false);
  });

  it('builds a provider against the server address + /v1', () => {
    const result = buildLocalProvider('http://127.0.0.1:4319', 'qwen2.5');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBeInstanceOf(OpenAIProvider);
    }
  });
});

describe('withStopSignal', () => {
  it('passes proposals through untouched while shouldStop() is false', async () => {
    const inner = { propose: async () => ({ proposal: { kind: 'task-done' as const, rationale: 'x' }, usage: { model: 'm', inputTokens: 0, outputTokens: 0, latencyMs: 0 } }) };
    const wrapped = withStopSignal(inner, () => false);
    const result = await wrapped.propose({} as never);
    expect(result.proposal.kind).toBe('task-done');
  });

  it('throws RUN_STOPPED_BY_USER and never calls inner once shouldStop() is true', async () => {
    let innerCalls = 0;
    const inner = {
      propose: async () => {
        innerCalls++;
        return { proposal: { kind: 'task-done' as const, rationale: 'x' }, usage: { model: 'm', inputTokens: 0, outputTokens: 0, latencyMs: 0 } };
      }
    };
    const wrapped = withStopSignal(inner, () => true);
    await expect(wrapped.propose({} as never)).rejects.toThrow(RUN_STOPPED_BY_USER);
    expect(innerCalls).toBe(0);
  });
});
