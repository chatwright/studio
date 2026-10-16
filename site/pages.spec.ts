import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headerRules, redirectRules, sitePages } from './pages';
import { studioDeepLinks } from './studio-deep-links';
import { resolveTryGithub, tryGithubPageDocument } from './try-github';
import { vanityModuleRepos, vanityPageDocument } from './vanity';

describe('studio deep links', () => {
  it('cover every non-wildcard path in src/app/app.routes.ts', () => {
    const source = readFileSync(new URL('../src/app/app.routes.ts', import.meta.url), 'utf8');
    const childrenOf = /path:\s*'([^']+)',\s*children:\s*\[([\s\S]*?)\n\s+\]/g;
    const expected = new Set<string>();
    let rest = source;
    for (const match of source.matchAll(childrenOf)) {
      for (const child of match[2].matchAll(/path:\s*'([^']*)'/g)) {
        expected.add(child[1] ? `${match[1]}/${child[1]}` : match[1]);
      }
      rest = rest.replace(match[0], '');
    }
    for (const top of rest.matchAll(/path:\s*'([^']*)'/g)) {
      if (top[1] && top[1] !== '**') {
        expected.add(top[1]);
      }
    }
    expect(expected.size).toBeGreaterThan(5);
    expect([...expected].filter((path) => !studioDeepLinks.includes(path))).toEqual([]);
  });
});

describe('_redirects', () => {
  const rules = redirectRules();

  it('stays within the Workers static-assets limits', () => {
    const dynamic = rules.filter((rule) => /[*:]/.test(rule.split(' ')[0]));
    expect(dynamic.length).toBeLessThanOrEqual(100);
    expect(rules.length - dynamic.length).toBeLessThanOrEqual(2000);
  });

  it('never rewrites a path that is itself a prerendered file', () => {
    // A 200 rewrite wins over an existing asset, so a source covering a real
    // file would shadow it.
    const served = Object.keys(sitePages).map((file) => `/${file.replace(/(index)?\.html$/, '')}`);
    for (const rule of rules) {
      const [source] = rule.split(' ');
      const prefix = source.endsWith('*') ? source.slice(0, -1) : null;
      for (const path of served) {
        expect(prefix ? path.startsWith(prefix) : path === source, `${rule} shadows ${path}`).toBe(false);
      }
    }
  });

  it('keeps the former Worker redirects and rewrites', () => {
    expect(rules).toContain('/prototype /studio/ 308');
    expect(rules).toContain('/prototype/* /studio/:splat 308');
    expect(rules).toContain('/studio /studio/ 308');
    expect(rules).toContain('/try/github/* /try-github 200');
    for (const root of Object.keys(vanityModuleRepos)) {
      expect(rules).toContain(`/${root} /go/${root} 200`);
      expect(rules).toContain(`/${root}/* /go/${root} 200`);
    }
  });

  it('sets installer content types in _headers', () => {
    expect(headerRules).toContain('/install.sh\n  Content-Type: text/x-shellscript; charset=utf-8');
  });
});

describe('Go vanity pages', () => {
  it('carry go-import and go-source metas for the module root', () => {
    const page = vanityPageDocument('cli', 'cli');
    expect(page).toContain('<meta name="go-import" content="chatwright.dev/cli git https://github.com/chatwright/cli">');
    expect(page).toContain(
      '<meta name="go-source" content="chatwright.dev/cli https://github.com/chatwright/cli https://github.com/chatwright/cli/tree/main{/dir} https://github.com/chatwright/cli/tree/main{/dir}/{file}#L{line}">'
    );
    expect(sitePages['go/sdk.html']).toContain('content="chatwright.dev/sdk git https://github.com/chatwright/sdk-go"');
  });
});

describe('resolveTryGithub', () => {
  it('resolves owner/repo with an optional manifest path and ref', () => {
    expect(resolveTryGithub('/try/github/chatwright/recipes', null)).toEqual({
      owner: 'chatwright',
      repo: 'recipes',
      repoURL: 'https://github.com/chatwright/recipes',
      manifestLocation: 'https://github.com/chatwright/recipes/blob/HEAD/CHATWRIGHT.md'
    });
    expect(resolveTryGithub('/try/github/a/b/sub/dir/', 'feature/x')?.manifestLocation).toBe(
      'https://github.com/a/b/blob/feature/x/sub/dir/CHATWRIGHT.md'
    );
  });

  it('rejects incomplete or unsafe targets', () => {
    expect(resolveTryGithub('/try/github/', null)).toBeNull();
    expect(resolveTryGithub('/try/github/owner', null)).toBeNull();
    expect(resolveTryGithub('/try/github/o%3Cx/r', null)).toBeNull();
    expect(resolveTryGithub('/try/github/o/r/%22', null)).toBeNull();
    expect(resolveTryGithub('/try/github/o/r', '<script>')).toBeNull();
    expect(resolveTryGithub('/elsewhere/o/r', null)).toBeNull();
  });

  it('is inlined into the page as self-contained browser code', () => {
    expect(tryGithubPageDocument).toContain('var resolveTryGithub = function resolveTryGithub(');
    expect(tryGithubPageDocument).not.toContain('innerHTML');
  });
});
