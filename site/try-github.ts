// The "Try in Chatwright" badge target, https://chatwright.dev/try/github/{owner}/{repo}[/{path}][?ref=...]
// Decision 0013-chatwright-md-federation.md in chatwright/chatwright fixes
// this route's contract: it must resolve with no registration, the moment a
// repository's CHATWRIGHT.md exists. The page makes no network call of its
// own (no fetch of the remote repository) — it is an honest, static interim
// page until the browser runtime lands; the real resolution (manifest fetch,
// player/runtime hand-off) is a follow-up design session's concern.
//
// Served statically: the build writes this one document to /try-github.html
// and `_redirects` rewrites (200) /try/github/* to it. The owner/repo/path/ref
// are read from location in the browser, validated with the same patterns
// the former Worker used, and written into the page with textContent/href
// only (never innerHTML). An invalid or incomplete path shows a "not found"
// panel (HTTP status is 200 — a static rewrite cannot vary it).
import { renderHeader, renderFooter, chromeStyles, themeInitScript } from './chrome';

export const tryGithubPrefix = '/try/github/';

export interface TryGithubTarget {
  owner: string;
  repo: string;
  repoURL: string;
  manifestLocation: string;
}

// Pure resolution of a request path + ?ref value into the page's links, or
// null when the path is not a valid /try/github/{owner}/{repo}[/path] target.
// The inline browser script is generated from this very function's source
// (Function.prototype.toString), so the page and the spec cannot drift —
// which is why it is self-contained (no references to module scope, which a
// bundler may rename) and written as plain browser JavaScript once types are stripped.
export function resolveTryGithub(pathname: string, refParam: string | null): TryGithubTarget | null {
  const prefix = '/try/github/';
  const ownerRepoPattern = /^[A-Za-z0-9_.-]+$/;
  // Extra path segments (a manifest subdirectory for monorepos) are looser
  // than owner/repo but still constrained to safe URL-path characters.
  const safeSegmentPattern = /^[A-Za-z0-9_.-]+$/;
  // A git ref (branch, tag or sha) may itself contain slashes (e.g.
  // "feature/foo"), so it gets its own, slightly wider, still-safe pattern.
  const safeRefPattern = /^[A-Za-z0-9_./-]+$/;
  if (pathname.indexOf(prefix) !== 0) {
    return null;
  }
  const segments = pathname.slice(prefix.length).split('/').filter(function (segment) { return segment.length > 0; });
  const owner = segments[0];
  const repo = segments[1];
  const pathSegments = segments.slice(2);
  if (!owner || !repo || !ownerRepoPattern.test(owner) || !ownerRepoPattern.test(repo)) {
    return null;
  }
  if (!pathSegments.every(function (segment) { return safeSegmentPattern.test(segment); })) {
    return null;
  }
  if (refParam !== null && !safeRefPattern.test(refParam)) {
    return null;
  }
  const repoURL = 'https://github.com/' + owner + '/' + repo;
  const ref = refParam ? refParam : 'HEAD';
  const manifestDir = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '';
  return {
    owner: owner,
    repo: repo,
    repoURL: repoURL,
    manifestLocation: repoURL + '/blob/' + ref + '/' + manifestDir + 'CHATWRIGHT.md'
  };
}

const clientScript = `<script>(function(){
  var resolveTryGithub = ${resolveTryGithub.toString()};
  var target = resolveTryGithub(location.pathname, new URLSearchParams(location.search).get('ref'));
  if (!target) {
    document.getElementById('try-found').hidden = true;
    document.getElementById('try-not-found').hidden = false;
    document.title = 'Not found — Chatwright';
    return;
  }
  var slug = target.owner + '/' + target.repo;
  document.title = 'Try ' + slug + ' in Chatwright — Chatwright';
  document.getElementById('try-slug').textContent = slug;
  var repoLink = document.getElementById('try-repo-link');
  repoLink.href = target.repoURL;
  repoLink.textContent = 'View ' + slug + ' on GitHub';
  document.getElementById('try-manifest-link').href = target.manifestLocation;
})();</script>`;

export const tryGithubPageDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <meta name="robots" content="noindex">
    <meta name="description" content="Try a repository in Chatwright — the repository declares a CHATWRIGHT.md manifest; this page links you to it and to the repository itself.">
    <title>Try in Chatwright — Chatwright</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%230f766e'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%230f766e'/%3E%3C/svg%3E">
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --faint:#8290a4; --line:#e5eaf0; --canvas:#fcfcfd; --card:#ffffff; --card-soft:#f7f9fb; --blue:#2c6dcc; --code-bg:#eef2f6; --code-ink:#1a2740; --accent:#0f766e; --accent-hover:#115e59; --accent-ink:#0d9488; --accent-tint-bg:#f0fdfa; --accent-tint-border:#99f6e4; --accent-tint-ink:#115e59; --nav-bg:rgba(252,252,253,.9); --nav-border:rgba(229,234,240,.9); --nav-hover-bg:#f2f5f8; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      ${chromeStyles}
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#fff; background:var(--accent); box-shadow:0 8px 20px rgba(15,118,110,.17); } .primary:hover { background:var(--accent-hover); } .quiet { border-color:var(--line); background:var(--card); }
      .doc { max-width:42rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(4rem,8vw,6rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.05; letter-spacing:-.045em; }
      .lede { max-width:42rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .self-id { margin:1rem 0 0; padding:.7rem .9rem; border:1px solid var(--line); border-radius:.5rem; background:var(--card); color:var(--soft); font-size:.85rem; line-height:1.55; } .self-id code { color:var(--accent-ink); font-weight:650; }
      article p { margin:.75rem 0; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article a { color:var(--accent-ink); font-weight:600; text-decoration:underline; text-decoration-color:rgba(13,148,136,.3); text-underline-offset:.15em; }
      article a:hover { text-decoration-color:currentColor; }
      code { padding:.12rem .34rem; border-radius:.32rem; background:var(--code-bg); color:var(--code-ink); font:500 .85em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .actions { display:flex; flex-wrap:wrap; gap:.7rem; margin-top:1.6rem; }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } }
    </style>
  </head>
  <body>
    ${renderHeader(null)}
    <main class="wrap doc">
      <article id="try-found">
        <p class="eyebrow">Try in Chatwright</p>
        <h1 id="try-slug">&nbsp;</h1>
        <p class="lede">This repository declares a <code>CHATWRIGHT.md</code> manifest — the file that joins a bot into the Chatwright knowledge graph (see the <a href="/formats/chatwright-md/v1">manifest format</a>).</p>
        <p class="self-id">Live in-browser demos land with the browser runtime — today this page links you to the repository and its manifest; the player already replays any run bundle the repository ships.</p>
        <p>Open the repository to read its <code>CHATWRIGHT.md</code>, see what it implements, and find any run bundles it publishes:</p>
        <div class="actions">
          <a class="button primary" id="try-repo-link" href="https://github.com/">View on GitHub</a>
          <a class="button quiet" id="try-manifest-link" href="/formats/chatwright-md/v1">Open CHATWRIGHT.md</a>
        </div>
      </article>
      <article id="try-not-found" hidden>
        <p class="eyebrow">Try in Chatwright</p>
        <h1>Not found</h1>
        <p class="lede">Badge links look like <code>https://chatwright.dev/try/github/OWNER/REPO</code>, optionally followed by a manifest subdirectory and <code>?ref=BRANCH</code>.</p>
      </article>
    </main>
    ${renderFooter()}
    ${clientScript}
  </body>
</html>
`;
