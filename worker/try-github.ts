// The "Try in Chatwright" badge target, https://chatwright.dev/try/github/{owner}/{repo}[/{path}][?ref=...]
// — see ./index.ts. Decision 0013-chatwright-md-federation.md in
// chatwright/chatwright fixes this route's contract: it must resolve with
// no registration, the moment a repository's CHATWRIGHT.md exists. This
// handler makes no network call of its own (no fetch of the remote
// repository) — it is an honest, static interim page until the browser
// runtime lands; the real resolution (manifest fetch, player/runtime
// hand-off) is a follow-up design session's concern.
const ownerRepoPattern = /^[A-Za-z0-9_.-]+$/;
// Extra path segments (a manifest subdirectory for monorepos) are looser
// than owner/repo but still constrained to safe URL-path characters — never
// permissive enough to carry HTML metacharacters through to the response.
const safeSegmentPattern = /^[A-Za-z0-9_.-]+$/;
// A git ref (branch, tag or sha) may itself contain slashes (e.g.
// "feature/foo"), so it gets its own, slightly wider, still-safe pattern.
const safeRefPattern = /^[A-Za-z0-9_./-]+$/;

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

const tryGithubPrefix = '/try/github/';

export function tryGithubResponse(incomingURL: URL, request: Request): Response | null {
  if (incomingURL.pathname !== tryGithubPrefix && !incomingURL.pathname.startsWith(tryGithubPrefix)) {
    return null;
  }

  const remainder = incomingURL.pathname.slice(tryGithubPrefix.length);
  const segments = remainder.split('/').filter((segment) => segment.length > 0);
  const [owner, repo, ...pathSegments] = segments;

  if (!owner || !repo || !ownerRepoPattern.test(owner) || !ownerRepoPattern.test(repo)) {
    return new Response('Not found', { status: 404 });
  }
  if (!pathSegments.every((segment) => safeSegmentPattern.test(segment))) {
    return new Response('Not found', { status: 404 });
  }
  const refParam = incomingURL.searchParams.get('ref');
  if (refParam !== null && !safeRefPattern.test(refParam)) {
    return new Response('Not found', { status: 404 });
  }

  // Validated against ownerRepoPattern/safeSegmentPattern above (safe URL-path
  // characters only — no HTML metacharacters are representable), and escaped
  // again on the way into markup as defense in depth.
  const safeOwner = escapeHtml(owner);
  const safeRepo = escapeHtml(repo);
  const repoURL = `https://github.com/${owner}/${repo}`;
  const manifestPath = pathSegments.length > 0 ? pathSegments.join('/') : null;
  const safeManifestPath = manifestPath ? escapeHtml(manifestPath) : null;
  const safeRef = refParam ? escapeHtml(refParam) : null;

  const document = tryGithubPageDocument({
    owner: safeOwner,
    repo: safeRepo,
    repoURL,
    manifestPath: safeManifestPath,
    ref: safeRef
  });

  return new Response(request.method === 'HEAD' ? null : document, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

function tryGithubPageDocument(params: {
  owner: string;
  repo: string;
  repoURL: string;
  manifestPath: string | null;
  ref: string | null;
}): string {
  const { owner, repo, repoURL, manifestPath, ref } = params;
  const title = `Try ${owner}/${repo} in Chatwright`;
  const manifestLocation = manifestPath ? `${repoURL}/blob/${ref ?? 'HEAD'}/${manifestPath}/CHATWRIGHT.md` : `${repoURL}/blob/${ref ?? 'HEAD'}/CHATWRIGHT.md`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="robots" content="noindex">
    <meta name="description" content="${escapeHtml(title)} — the repository declares a CHATWRIGHT.md manifest; this page links you to it and to the repository itself.">
    <title>${escapeHtml(title)} — Chatwright</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%2350cba0'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%2350cba0'/%3E%3C/svg%3E">
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --line:#e5eaf0; --canvas:#fcfcfd; --blue:#2c6dcc; --mint:#50cba0; --mint-ink:#0d5e49; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      .nav { position:sticky; z-index:10; top:0; border-bottom:1px solid rgba(229,234,240,.9); background:rgba(252,252,253,.9); backdrop-filter:blur(16px); }
      .nav > .wrap { min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:1.2rem; }
      .brand { color:var(--ink); font-size:1.1rem; font-weight:730; letter-spacing:-.05em; text-decoration:none; } .brand small { margin-left:.45rem; color:var(--soft); font-size:.65rem; font-weight:650; letter-spacing:.02em; }
      .links { display:flex; align-items:center; gap:1.35rem; color:#4e5c70; font-size:.85rem; } .links a { text-decoration:none; } .links a:hover { color:var(--ink); }
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#06271d; background:var(--mint); box-shadow:0 8px 20px rgba(80,203,160,.17); } .quiet { border-color:var(--line); background:#fff; }
      .doc { max-width:42rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(4rem,8vw,6rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.05; letter-spacing:-.045em; }
      .lede { max-width:42rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .self-id { margin:1rem 0 0; padding:.7rem .9rem; border:1px solid var(--line); border-radius:.5rem; background:#fff; color:var(--soft); font-size:.85rem; line-height:1.55; } .self-id code { color:var(--mint-ink); font-weight:650; }
      article p { margin:.75rem 0; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article a { color:var(--mint-ink); font-weight:600; text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; }
      article a:hover { text-decoration-color:currentColor; }
      code { padding:.12rem .34rem; border-radius:.32rem; background:#eef2f6; color:#1a2740; font:500 .85em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .actions { display:flex; flex-wrap:wrap; gap:.7rem; margin-top:1.6rem; }
      footer { padding:2.5rem 0 3rem; color:#718094; font-size:.78rem; } footer .wrap { display:flex; justify-content:space-between; gap:1rem; border-top:1px solid var(--line); padding-top:1.45rem; } footer a { color:var(--soft); text-decoration:none; }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } .nav > .wrap { min-height:64px; } .links { display:none; } .brand small { display:none; } footer .wrap { align-items:flex-start; flex-direction:column; } }
    </style>
  </head>
  <body>
    <header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Chatwright home">Chatwright <small>by sneat.dev</small></a><nav class="links" aria-label="Primary navigation"><a href="/">Home</a><a href="/studio/">Studio</a><a href="https://github.com/chatwright/chatwright">GitHub</a></nav><a class="button primary" href="/studio/">Open Studio</a></div></header>
    <main class="wrap doc">
      <article>
        <p class="eyebrow">Try in Chatwright</p>
        <h1>${owner}/${repo}</h1>
        <p class="lede">This repository declares a <code>CHATWRIGHT.md</code> manifest — the file that joins a bot into the Chatwright knowledge graph (see the <a href="/formats/chatwright-md/v1">manifest format</a>).</p>
        <p class="self-id">Live in-browser demos land with the browser runtime — today this page links you to the repository and its manifest; the player already replays any run bundle the repository ships.</p>
        <p>Open the repository to read its <code>CHATWRIGHT.md</code>, see what it implements, and find any run bundles it publishes:</p>
        <div class="actions">
          <a class="button primary" href="${repoURL}">View ${owner}/${repo} on GitHub</a>
          <a class="button quiet" href="${manifestLocation}">Open CHATWRIGHT.md</a>
        </div>
      </article>
    </main>
    <footer><div class="wrap"><span>An independent open-source project by Sneat.co</span><a href="https://sneat.dev/">Explore sneat.dev →</a></div></footer>
  </body>
</html>
`;
}
