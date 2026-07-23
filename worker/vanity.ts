// Go vanity import paths for chatwright.dev/<root>.
//
// This lets `go get`/`go install chatwright.dev/<root>/...` resolve to the
// real GitHub repo without the repo layout ever leaking into import paths
// (see chatwright/chatwright spec/plans/code-split-restructuring.md, Task 0,
// and spec/ideas/engine-sdk-repo-split.md). The `sdk`, `runtime` and `cli`
// repos below don't exist yet at the time this route ships — that's fine:
// this handler is only consulted when someone actually requests one of
// those module paths, so an unresolved mapping is harmless until the repo
// split (Tasks 2-4) lands. `vanity-proof` is the throwaway module used to
// prove the flow end-to-end before the real cut.
const vanityModuleRepos: Record<string, string> = {
  sdk: 'sdk-go',
  runtime: 'runtime-go',
  cli: 'cli',
  'vanity-proof': 'vanity-proof'
};

// Go queries the *full* package path (e.g. /cli/cmd/chatwright?go-get=1), not
// just the module root, and accepts a go-import meta whose content is a
// prefix of the requested path. So we only need to match the first path
// segment and can ignore everything after it.
export function vanityImportResponse(incomingURL: URL, request: Request): Response | null {
  const rootSegment = incomingURL.pathname.split('/')[1];
  const repo = rootSegment ? vanityModuleRepos[rootSegment] : undefined;

  if (!repo) {
    return null;
  }

  const repoURL = `https://github.com/chatwright/${repo}`;

  if (incomingURL.searchParams.get('go-get') !== '1') {
    return Response.redirect(repoURL, 302);
  }

  const importPrefix = `chatwright.dev/${rootSegment}`;
  const document = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="go-import" content="${importPrefix} git ${repoURL}">
    <meta name="go-source" content="${importPrefix} ${repoURL} ${repoURL}/tree/main{/dir} ${repoURL}/tree/main{/dir}/{file}#L{line}">
  </head>
  <body>go get ${importPrefix}</body>
</html>
`;

  return new Response(request.method === 'HEAD' ? null : document, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
