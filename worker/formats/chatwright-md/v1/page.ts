// Human-readable documentation for the CHATWRIGHT.md manifest format v1,
// served at exactly https://chatwright.dev/formats/chatwright-md/v1 (and its
// trailing-slash variant) — see ../../../index.ts. Content adapts
// chatwright/chatwright's formats/chatwright-md/v1/README.md and decision
// 0013-chatwright-md-federation.md; see ./README.md for how schema.json
// alongside this file is kept in sync.
export const chatwrightMdV1PageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="description" content="CHATWRIGHT.md manifest format v1: the repository manifest that joins a bot into the Chatwright knowledge graph — front matter, versioning by git tag, and the Try in Chatwright badge.">
    <title>CHATWRIGHT.md manifest format v1 — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/formats/chatwright-md/v1">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%2350cba0'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%2350cba0'/%3E%3C/svg%3E">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="CHATWRIGHT.md manifest format v1 — Chatwright">
    <meta property="og:description" content="The repository manifest that joins a bot into the Chatwright knowledge graph — front matter, versioning by git tag, and the Try in Chatwright badge.">
    <meta property="og:url" content="https://chatwright.dev/formats/chatwright-md/v1">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="CHATWRIGHT.md manifest format v1 — Chatwright">
    <meta name="twitter:description" content="The repository manifest that joins a bot into the Chatwright knowledge graph — front matter, versioning by git tag, and the Try in Chatwright badge.">
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
      .doc { display:grid; grid-template-columns:minmax(0,42rem) minmax(11rem,14rem); align-items:start; gap:clamp(2rem,5vw,4.5rem); padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(4rem,8vw,6rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.05; letter-spacing:-.045em; }
      .lede { max-width:42rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .self-id { margin:1rem 0 0; padding:.7rem .9rem; border:1px solid var(--line); border-radius:.5rem; background:#fff; color:var(--soft); font-size:.85rem; line-height:1.55; } .self-id code { color:var(--mint-ink); font-weight:650; }
      article h2 { margin:2.6rem 0 .6rem; font-size:1.45rem; letter-spacing:-.03em; scroll-margin-top:5.5rem; }
      article h3 { margin:1.9rem 0 .5rem; font-size:1.08rem; letter-spacing:-.02em; scroll-margin-top:5.5rem; }
      article p { margin:.75rem 0; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article ul, article ol { margin:.75rem 0; padding-left:1.25rem; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article li { margin:.3rem 0; }
      article li strong { color:var(--ink); }
      article a { color:var(--mint-ink); font-weight:600; text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; }
      article a:hover { text-decoration-color:currentColor; }
      code { padding:.12rem .34rem; border-radius:.32rem; background:#eef2f6; color:#1a2740; font:500 .85em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      pre { overflow:auto; margin:.85rem 0; padding:1rem 1.1rem; border-radius:.65rem; color:#d5e4ef; background:#101925; font:500 .78rem/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; tab-size:2; }
      pre code { padding:0; border-radius:0; background:none; color:inherit; font:inherit; }
      figure { margin:0; } figcaption { margin:.4rem 0 0; color:#8290a4; font-size:.75rem; letter-spacing:.01em; }
      .note { margin:.85rem 0; padding:.75rem .95rem; border:1px solid var(--line); border-left:3px solid var(--blue); border-radius:0 .45rem .45rem 0; background:#fff; color:var(--soft); font-size:.9rem; line-height:1.6; } .note strong { color:var(--ink); }
      .convlist { margin:1rem 0; padding:0; list-style:none; display:grid; gap:.7rem; }
      .convlist li { padding:.85rem 1rem; border:1px solid var(--line); border-radius:.6rem; background:#fff; }
      .convlist strong { display:block; margin-bottom:.2rem; color:var(--ink); font-size:.92rem; }
      .convlist span { color:var(--soft); font-size:.88rem; line-height:1.6; }
      aside.toc { position:sticky; top:5.5rem; align-self:start; }
      aside.toc p { margin:0 0 .6rem; color:#8290a4; font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.1em; text-transform:uppercase; }
      aside.toc ol { margin:0; padding:0; list-style:none; display:grid; gap:.45rem; border-left:1px solid var(--line); }
      aside.toc a { display:block; padding:.15rem 0 .15rem .85rem; color:var(--soft); font-size:.83rem; text-decoration:none; }
      aside.toc a:hover { color:var(--ink); }
      @media (max-width:900px) { .doc { grid-template-columns:1fr; } aside.toc { display:none; } }
      footer { padding:2.5rem 0 3rem; color:#718094; font-size:.78rem; } footer .wrap { display:flex; justify-content:space-between; gap:1rem; border-top:1px solid var(--line); padding-top:1.45rem; } footer a { color:var(--soft); text-decoration:none; }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } .nav > .wrap { min-height:64px; } .links { display:none; } .brand small { display:none; } footer .wrap { align-items:flex-start; flex-direction:column; } }
    </style>
  </head>
  <body>
    <header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Chatwright home">Chatwright <small>by sneat.dev</small></a><nav class="links" aria-label="Primary navigation"><a href="/">Home</a><a href="/studio/">Studio</a><a href="https://github.com/chatwright/chatwright">GitHub</a></nav><a class="button primary" href="/studio/">Open Studio</a></div></header>
    <main class="wrap doc">
      <article>
        <p class="eyebrow">Formats · chatwright-md · v1</p>
        <h1>CHATWRIGHT.md manifest format v1</h1>
        <p class="lede">A repository joins the Chatwright knowledge graph by adding one file: <code>CHATWRIGHT.md</code>, a readable Markdown document with structured YAML front matter at the top. Humans read the Markdown; Chatwright — the website, the <code>Try in Chatwright</code> badge resolver, the central index — reads the front matter.</p>
        <p class="self-id">This page's own address is the format identifier: a manifest declares it with <code>format: https://chatwright.dev/formats/chatwright-md/v1</code> at the top of its front matter. See <a href="#versioning">Versioning</a> for how a manifest's own version is resolved.</p>

        <h2 id="what-it-is">What it is</h2>
        <p>Place <code>CHATWRIGHT.md</code> at the repository root — or a subdirectory for monorepos, in which case the badge URL carries the path — and link it prominently from <code>README.md</code>. Markdown section headings after the front matter follow a convention (<code>About</code>, <code>Jobs</code>, <code>Recipes</code>, <code>Capabilities</code>, <code>Demo</code>, <code>Running locally</code>, <code>Trade-offs</code>, <code>Examples</code>) so future tooling can lift the prose too, but the front matter is the normative machine contract today.</p>

        <h2 id="front-matter">Front matter</h2>
        <figure><pre><code>---
format: https://chatwright.dev/formats/chatwright-md/v1
id: acme-rsvp-bot            # globally unique, kebab-case — the identity;
                             # never derived from the repository name
name: Acme RSVP Bot
version: 1.2.0               # must match a git tag (v1.2.0 or 1.2.0)
authors:
  - github: acme-dev         # GitHub login anchors identity
platforms: [telegram]        # platform ids
bots:
  - id: rsvp                 # unique within this manifest
    platform: telegram
    transport: iframe        # iframe | http
    url: https://acme.dev/chatwright-bot/   # iframe src, or HTTPS endpoint
    capabilities:            # capability keys the bot exercises
      - messaging.buttons.inline
      - messaging.message.edit
implements:                  # knowledge-graph references (ids in
  - recipe: collect-rsvp     # chatwright/recipes)
    platform: telegram
    tier: community           # official | alternative | community
jobs: [collect-rsvp-for-event]
demos:
  - bot: rsvp                # bot id above
    title: RSVP happy path
    scenario: scenarios/rsvp-happy-path.chatwright.json  # optional today
tags: [rsvp, events]
---</code></pre><figcaption>A repository's front matter — every field explained below.</figcaption></figure>

        <h2 id="required-fields">Required fields</h2>
        <p>Required: <code>format</code>, <code>id</code>, <code>name</code>, <code>version</code>, <code>authors</code>, <code>platforms</code>, <code>bots</code>. Everything else is optional, and unknown keys are ignored — a manifest written for a future minor release still reads cleanly today.</p>
        <ul>
          <li><strong>id</strong> — the identity, globally unique, kebab-case. Never the repository name: names are transferable and squattable, so identity has to survive a rename or fork.</li>
          <li><strong>bots</strong> — each with a <code>transport</code> of <code>iframe</code> or <code>http</code>, its URL, and the capability keys it exercises (the same vocabulary the browser runtime and compatibility tables use).</li>
          <li><strong>implements / jobs</strong> — the Recipes, Implementations and Jobs this repository provides, referencing ids in the central index.</li>
          <li><strong>demos</strong> — bot + scenario pairs, each naming a bot id declared above.</li>
        </ul>

        <h2 id="versioning">Versioning</h2>
        <p><code>version</code> must match a git tag of the repository — Terraform-style publishing, where tagging <strong>is</strong> releasing. There is no separate per-release registration step: a consumer resolves <code>id@version</code> straight through the tag, and the central index caches manifest snapshots per version so a deleted upstream repository doesn't silently break every embed that already points at one.</p>

        <h2 id="badge">The badge</h2>
        <p>No registration is required. The badge works the moment a repository's <code>CHATWRIGHT.md</code> exists:</p>
        <figure><pre><code>[![Try in Chatwright](https://chatwright.dev/badge.svg)](https://chatwright.dev/try/github/OWNER/REPO)</code></pre></figure>
        <p>It links to <code>https://chatwright.dev/try/github/{owner}/{repo}[/{path}][?ref={branch|tag|sha}]</code> — plain, hand-editable path segments pointing straight at the repository, or a subdirectory holding <code>CHATWRIGHT.md</code> for a monorepo. Listing in the <a href="https://github.com/chatwright/recipes">central index</a> is the optional discovery layer on top; add the GitHub topic <code>chatwright-bot</code> for zero-friction discovery either way.</p>

        <h2 id="schema">Schema and the central index</h2>
        <p>The complete front-matter contract is published as a machine-readable <a href="/formats/chatwright-md/v1/schema.json">JSON Schema</a> (draft 2020-12) — hand-authored until generation tooling exists, the same way the run-bundle schema started. First-party content, the registry of federated repositories, and a cached snapshot of every registered manifest live in <a href="https://github.com/chatwright/recipes">chatwright/recipes</a>, the curated central index.</p>
      </article>
      <aside class="toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          <li><a href="#what-it-is">What it is</a></li>
          <li><a href="#front-matter">Front matter</a></li>
          <li><a href="#required-fields">Required fields</a></li>
          <li><a href="#versioning">Versioning</a></li>
          <li><a href="#badge">The badge</a></li>
          <li><a href="#schema">Schema &amp; index</a></li>
        </ol>
      </aside>
    </main>
    <footer><div class="wrap"><span>An independent open-source project by Sneat.co</span><a href="https://sneat.dev/">Explore sneat.dev →</a></div></footer>
  </body>
</html>`;
