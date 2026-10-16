// Go vanity import paths for chatwright.dev/<root>.
//
// This lets `go get`/`go install chatwright.dev/<root>/...` resolve to the
// real GitHub repo without the repo layout ever leaking into import paths
// (see chatwright/chatwright spec/plans/code-split-restructuring.md, Task 0,
// and spec/ideas/engine-sdk-repo-split.md). `vanity-proof` is the throwaway
// module used to prove the flow end-to-end before the real cut.
//
// Served statically: the build writes one page per root to
// /go/<root>.html, and `_redirects` rewrites (200) both /<root> and
// /<root>/* to it. Go queries the *full* package path
// (e.g. /cli/cmd/chatwright?go-get=1), not just the module root, and accepts
// a go-import meta whose content is a prefix of the requested path, so one
// page per root answers every package path below it. `_redirects` cannot
// match on the query string, so the same page also answers browsers (no
// ?go-get=1): it carries a meta refresh to the GitHub repository, which
// `go get` ignores.
export const vanityModuleRepos: Record<string, string> = {
  sdk: 'sdk-go',
  runtime: 'runtime-go',
  cli: 'cli',
  'vanity-proof': 'vanity-proof'
};

export function vanityPageDocument(rootSegment: string, repo: string): string {
  const repoURL = `https://github.com/chatwright/${repo}`;
  const importPrefix = `chatwright.dev/${rootSegment}`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="go-import" content="${importPrefix} git ${repoURL}">
    <meta name="go-source" content="${importPrefix} ${repoURL} ${repoURL}/tree/main{/dir} ${repoURL}/tree/main{/dir}/{file}#L{line}">
    <meta http-equiv="refresh" content="0; url=${repoURL}">
    <meta name="robots" content="noindex">
  </head>
  <body>go get ${importPrefix} — <a href="${repoURL}">${repoURL}</a></body>
</html>
`;
}
