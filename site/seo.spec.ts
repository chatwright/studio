import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sitePages, sitemapDocument, redirectRules, studioDeepLinks, studioShell } from './pages';
import { studioMetadata } from '../src/app/studio-metadata';

const shell = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

describe('SEO delivery', () => {
  it('includes public canonical pages and excludes private, resolver and vanity pages', () => {
    const studioPages = Object.fromEntries(studioDeepLinks.map((route) => [`studio/${route}.html`, studioShell(shell, route)]));
    const sitemap = sitemapDocument({ ...sitePages, ...studioPages, 'studio/index.html': studioShell(shell, '') });
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    expect(urls).toEqual([
      '/', '/about/tech-stack/', '/formats/chatwright-md/v1', '/formats/run-bundle/v1',
      '/guides', '/guides/telegram-bot-tests-in-ci', '/guides/test-inline-buttons-and-message-edits', '/guides/test-telegram-bot-locally',
      '/pricing', '/quickstart', '/recipes', '/studio/player', '/studio/playground'
    ].map((path) => `https://chatwright.dev${path}`));
    // New public pages enter automatically; duplicate canonical URLs appear once.
    const added = sitemapDocument({ ...sitePages, 'guide.html': '<link rel="canonical" href="https://chatwright.dev/guide">', 'copy.html': sitePages['index.html'] });
    expect(added).toContain('<loc>https://chatwright.dev/guide</loc>');
    expect(added.match(/<loc>https:\/\/chatwright.dev\/<\/loc>/g)).toHaveLength(1);
  });

  it.each(['player', 'playground'])('serves useful %s metadata and content before JavaScript', (route) => {
    const html = studioShell(shell, route);
    expect(html).toContain(`<title>${studioMetadata(route).title}</title>`);
    expect(html).toContain(`rel="canonical" href="https://chatwright.dev/studio/${route}"`);
    expect(html).toContain('<meta name="robots" content="index,follow">');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain('<cw-root><main><h1>');
    expect(html).toContain('<base href="/" />');
    expect(html).not.toContain('mock-ups');
    expect(html).not.toContain('Prototype');
    expect(redirectRules()).not.toContain(`/studio/${route} /studio/ 200`);
  });

  it('keeps prototypes and saved recordings out of search', () => {
    for (const route of ['recordings', 'prototypes/workspace', 'workspace', 'not-found']) {
      expect(studioShell(shell, route)).toContain('<meta name="robots" content="noindex,follow">');
    }
  });

  it('normalises query strings and fragments without exposing recording IDs in canonical URLs', () => {
    expect(studioMetadata('/player?recording=private-id#event-2')).toEqual(studioMetadata('player'));
    expect(studioMetadata('/playground/?embed=1')).toEqual(studioMetadata('playground'));
    expect(studioMetadata('').canonical).toBe('https://chatwright.dev/studio/playground');
  });
});
