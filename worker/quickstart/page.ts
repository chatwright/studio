// Human-readable quickstart for `chatwright run`, served at exactly
// https://chatwright.dev/quickstart (and its trailing-slash variant) — see
// ../index.ts. This is a command walkthrough, not a format page: it has no
// accompanying schema.json (unlike worker/formats/*/v1) because the
// scenario-document/v1 format itself is not yet published at its own
// chatwright.dev/formats URL — see the "Learn more" section below, which
// links out to its specification in chatwright/chatwright instead of
// implying a page that doesn't exist yet. Every command, flag, output line
// and install path here was run and verified against chatwright/cli v0.3.0
// (over chatwright.dev/runtime v0.4.0) before this file was written — see
// this repository's PR description for the transcripts.
import { renderHeader, renderFooter, chromeStyles, themeInitScript } from '../chrome';

export const quickstartPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <meta name="description" content="chatwright run DOCUMENT [--out DIR]: execute a self-contained scenario document — a bot, an AI goal, its tasks and budgets — with no manifest and no Go code, and write a replayable run bundle.">
    <title>Run a scenario document — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/quickstart">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%230f766e'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%230f766e'/%3E%3C/svg%3E">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="Run a scenario document — Chatwright">
    <meta property="og:description" content="chatwright run DOCUMENT [--out DIR]: execute a self-contained scenario document — a bot, an AI goal, its tasks and budgets — with no manifest and no Go code, and write a replayable run bundle.">
    <meta property="og:url" content="https://chatwright.dev/quickstart">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Run a scenario document — Chatwright">
    <meta name="twitter:description" content="chatwright run DOCUMENT [--out DIR]: execute a self-contained scenario document with no manifest and no Go code, and write a replayable run bundle.">
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --faint:#8290a4; --line:#e5eaf0; --canvas:#fcfcfd; --card:#ffffff; --card-soft:#f7f9fb; --blue:#2c6dcc; --code-bg:#eef2f6; --code-ink:#1a2740; --accent:#0f766e; --accent-hover:#115e59; --accent-ink:#0d9488; --accent-tint-bg:#f0fdfa; --accent-tint-border:#99f6e4; --accent-tint-ink:#115e59; --nav-bg:rgba(252,252,253,.9); --nav-border:rgba(229,234,240,.9); --nav-hover-bg:#f2f5f8; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      ${chromeStyles}
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#fff; background:var(--accent); box-shadow:0 8px 20px rgba(15,118,110,.17); } .primary:hover { background:var(--accent-hover); } .quiet { border-color:var(--line); background:var(--card); }
      .doc { display:grid; grid-template-columns:minmax(0,42rem) minmax(11rem,14rem); align-items:start; gap:clamp(2rem,5vw,4.5rem); padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(4rem,8vw,6rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.05; letter-spacing:-.045em; }
      .lede { max-width:42rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .self-id { margin:1rem 0 0; padding:.7rem .9rem; border:1px solid var(--line); border-radius:.5rem; background:var(--card); color:var(--soft); font-size:.85rem; line-height:1.55; } .self-id code { color:var(--accent-ink); font-weight:650; }
      article h2 { margin:2.6rem 0 .6rem; font-size:1.45rem; letter-spacing:-.03em; scroll-margin-top:5.5rem; }
      article h3 { margin:1.9rem 0 .5rem; font-size:1.08rem; letter-spacing:-.02em; scroll-margin-top:5.5rem; }
      article p { margin:.75rem 0; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article ul, article ol { margin:.75rem 0; padding-left:1.25rem; color:var(--soft); font-size:.96rem; line-height:1.7; }
      article li { margin:.3rem 0; }
      article li strong { color:var(--ink); }
      article a { color:var(--accent-ink); font-weight:600; text-decoration:underline; text-decoration-color:rgba(13,148,136,.3); text-underline-offset:.15em; }
      article a:hover { text-decoration-color:currentColor; }
      code { padding:.12rem .34rem; border-radius:.32rem; background:var(--code-bg); color:var(--code-ink); font:500 .85em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      pre { overflow:auto; margin:.85rem 0; padding:1rem 1.1rem; border-radius:.65rem; color:#d5e4ef; background:#101925; font:500 .78rem/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; tab-size:2; }
      pre code { padding:0; border-radius:0; background:none; color:inherit; font:inherit; }
      figure { margin:0; } figcaption { margin:.4rem 0 0; color:var(--faint); font-size:.75rem; letter-spacing:.01em; }
      .note { margin:.85rem 0; padding:.75rem .95rem; border:1px solid var(--line); border-left:3px solid var(--blue); border-radius:0 .45rem .45rem 0; background:var(--card); color:var(--soft); font-size:.9rem; line-height:1.6; } .note strong { color:var(--ink); }
      aside.toc { position:sticky; top:5.5rem; align-self:start; }
      aside.toc p { margin:0 0 .6rem; color:var(--faint); font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.1em; text-transform:uppercase; }
      aside.toc ol { margin:0; padding:0; list-style:none; display:grid; gap:.45rem; border-left:1px solid var(--line); }
      aside.toc a { display:block; padding:.15rem 0 .15rem .85rem; color:var(--soft); font-size:.83rem; text-decoration:none; }
      aside.toc a:hover { color:var(--ink); }
      @media (max-width:900px) { .doc { grid-template-columns:1fr; } aside.toc { display:none; } }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } }
    </style>
  </head>
  <body>
    ${renderHeader(null)}
    <main class="wrap doc">
      <article>
        <p class="eyebrow">CLI · chatwright run</p>
        <h1>Run a scenario document</h1>
        <p class="lede"><code>chatwright run DOCUMENT [--out DIR]</code> executes one self-contained scenario file — a bot, an AI goal, its tasks and budgets — and writes a replayable <code>*.chatwright.json</code> run bundle. No manifest. No Go scenario to register or rebuild.</p>
        <div class="note"><strong>Go CLI, today.</strong> <code>chatwright run</code> ships in <a href="https://github.com/chatwright/cli">chatwright/cli</a> v0.3.0, over <code>chatwright.dev/runtime</code> v0.4.0. It is not available in the browser runtime or Chatwright Studio's Playground yet — see <a href="#today">What's true today</a> before you point it at a bot of your own.</div>

        <h2 id="install">Install the CLI</h2>
        <p>Canonical, macOS/Linux:</p>
        <figure><pre><code>curl -fsSL https://chatwright.dev/install.sh | sh</code></pre></figure>
        <p>The default install directory is <code>/usr/local/bin</code>, which needs <code>sudo</code> on most systems. Point it at a directory you already own instead by setting <code>BINDIR</code>:</p>
        <figure><pre><code>curl -fsSL https://chatwright.dev/install.sh | BINDIR="$HOME/.local/bin" sh</code></pre></figure>
        <p>Alternatives — Homebrew (macOS) or Go-native, either always resolves to the latest tag:</p>
        <figure><pre><code>brew install --cask chatwright/tap/chatwright
go install chatwright.dev/cli/cmd/chatwright@v0.3.0</code></pre></figure>
        <p>Confirm it landed:</p>
        <figure><pre><code>chatwright version</code></pre></figure>

        <h2 id="the-document">The document</h2>
        <p>A scenario document is one committed JSON file — format <code>https://chatwright.dev/formats/scenario-document/v1</code> — declaring a bot endpoint, the cast, and one or more parts (an <code>ai-goal</code> part carries the goal's tasks and budgets). Below is the runtime's own conformance fixture: the greetbot scenario — send <code>/start</code>, click the action labelled "English", wait for the greeting to be edited in place, then acknowledge it — expressed with nothing compiled into Go.</p>
        <figure><pre><code>{
  "format": "https://chatwright.dev/formats/scenario-document/v1",
  "schemaVersion": 1,
  "id": "greetbot-language-onboarding",
  "version": "v1",
  "title": "Complete language onboarding and acknowledge the greeting",
  "requires": ["ai-goal", "exampleBot:greetbot"],
  "fidelity": {
    "endpointProfile": "platform-emulated",
    "environment": "dev",
    "dataSensitivity": "synthetic"
  },
  "platform": "telegram",
  "chats": [{"id": "main", "platformChatId": 42}],
  "bot": {"id": "greetbot", "name": "GreetBot", "exampleBot": "greetbot"},
  "cast": [
    {
      "id": "arena",
      "type": "ai-agent",
      "name": "Arena",
      "platformIdentity": {"userId": 7, "firstName": "Arena"},
      "provider": {
        "kind": "cassette",
        "mode": "replay",
        "cassette": "cassettes/greetbot-language-onboarding.json"
      }
    }
  ],
  "parts": [
    {
      "id": "language-onboarding",
      "kind": "ai-goal",
      "chat": "main",
      "actorId": "arena",
      "goal": {
        "id": "language-onboarding-arena",
        "title": "Complete language onboarding and acknowledge the greeting",
        "tasks": [{
          "id": "language-onboarding",
          "successCriteria": "Send \"/start\". Click the action labelled exactly \"English\". After the greeting is edited in place, send one short text message acknowledging it. Only then declare the task done."
        }],
        "budgets": {"maxSteps": 12, "maxDurationSeconds": 240}
      }
    }
  ],
  "verify": {
    "chat": "main",
    "metDetail": "started, clicked English, acknowledged — all journal-verified",
    "journal": [
      {"id": "sent-start", "unmetDetail": "never sent /start", "all": [
        {"field": "kind", "op": "exact", "value": "message"},
        {"field": "direction", "op": "exact", "value": "user"},
        {"field": "text", "op": "exact", "value": "/start"}
      ]},
      {"id": "greeting-changed", "unmetDetail": "never got the English greeting (wrong/no click)", "all": [
        {"field": "kind", "op": "exact", "value": "message"},
        {"field": "direction", "op": "exact", "value": "bot"},
        {"field": "edited", "op": "exact", "value": true},
        {"field": "text", "op": "exact", "value": "Howdy stranger"}
      ]},
      {"id": "acknowledged", "unmetDetail": "never sent an acknowledgement after the greeting changed", "all": [
        {"field": "kind", "op": "exact", "value": "message"},
        {"field": "direction", "op": "exact", "value": "user"},
        {"field": "text", "op": "regex", "value": "\\S"},
        {"field": "text", "op": "exact", "value": "/start", "negate": true}
      ]}
    ]
  }
}</code></pre><figcaption>Elided for readability — the real file also carries <code>description</code>, task <code>title</code>s and a <code>verifies</code> acceptance-criterion binding. The full, unedited fixture is linked below.</figcaption></figure>
        <p>Note what is <em>not</em> here: no bot token, no API key. <code>bot.exampleBot</code> names a bot the runtime itself ships — no authorable URL needed — and <code>cast[0].provider</code> is a <code>cassette</code> replaying a checked-in recording rather than calling a live model. Point the document at a bot of your own by replacing <code>bot</code> with a <code>url</code> and a <code>transport</code> instead — see <a href="#today">What's true today</a> for what that costs.</p>

        <h2 id="run-it">Run it</h2>
        <p>Fetch the fixture above together with its checked-in cassette from <code>chatwright/runtime-go</code>'s own test data, then run it — no account, no API key:</p>
        <figure><pre><code>mkdir -p greetbot-quickstart/cassettes &amp;&amp; cd greetbot-quickstart

curl -fsSL -o greetbot-language-onboarding.json \
  https://raw.githubusercontent.com/chatwright/runtime-go/main/scenario/testdata/greetbot-language-onboarding.json
curl -fsSL -o cassettes/greetbot-language-onboarding.json \
  https://raw.githubusercontent.com/chatwright/runtime-go/main/scenario/testdata/cassettes/greetbot-language-onboarding.json

chatwright run greetbot-language-onboarding.json --out .</code></pre></figure>
        <p>Real, unedited output:</p>
        <figure><pre><code>chatwright run: warning: no run-level ceiling is declared; only each part's own budgets bind (no-run-ceiling)
greetbot-language-onboarding: part status=completed, outcome=verified: started, clicked English, acknowledged — all journal-verified
wrote greetbot-language-onboarding.chatwright.json</code></pre></figure>
        <p>The first line is a validation warning, not a failure: this document declares no run-level <code>ceiling</code>, so only each part's own <code>budgets</code> bind — reported so an unbounded aggregate is a visible authoring choice, never a silent one. The second line is the command's own one-line summary: the last part's status, then the outcome. <strong>Verified</strong> means the document declared a <code>verify</code> block and every journal expectation in it matched, independently of whatever the AI actor itself claimed; a document with no <code>verify</code> block is always reported <strong>judged</strong> instead, never verified. <code>--out</code> defaults to <code>.</code>; the bundle filename is always <code>&lt;document id&gt;.chatwright.json</code>. The bundle is written either way — a failed or incomplete run still leaves evidence — and the process exits non-zero only when the final part didn't complete, so <code>chatwright run</code> composes with a CI step that gates on the exit code alone.</p>

        <h2 id="replay">Replay it</h2>
        <p>Drop the <code>*.chatwright.json</code> file this just wrote onto <a href="/studio/player">the Studio player</a> — it replays entirely client-side; nothing is uploaded. Its full shape is documented at <a href="/formats/run-bundle/v1">run-bundle format v1</a>.</p>

        <h2 id="today">What's true today</h2>
        <p><code>chatwright run</code> ships in the Go CLI only. <code>runtime-ts</code> — the browser runtime behind Chatwright Studio's Playground — does not yet execute a scenario document or drive an AI-goal actor loop; that gap is tracked openly in <a href="https://github.com/chatwright/chatwright/blob/main/docs/runtime-parity.md">the runtime parity register</a>, not shipped. Studio remains the replay surface for the run bundle this command writes — dropping a bundle onto the player is not the same as running the document that produced it.</p>
        <p>The only bot transport that works in both runtimes today is a bot compiled into the runtime itself — an <code>exampleBot</code> such as <code>greetbot</code>, used above. A document that instead names a remote bot over HTTP (<code>bot.transport: "http"</code>, pointing your bot's Bot API base URL at the emulator) runs today in the Go runtime; the browser runtime has no inbound HTTP surface to receive a webhook or serve <code>getUpdates</code>, so the same document is refused there by name — never silently approximated or run a different way. The reverse holds too: an iframe-hosted bot (<code>bot.transport: "iframe"</code>) is a browser-runtime concept the Go runtime doesn't provide.</p>

        <h2 id="learn-more">Learn more</h2>
        <ul>
          <li><code>chatwright run help</code> prints the command's own usage text.</li>
          <li>The scenario-document format's full specification — secrets handling, budgets, independent verification, the cast and its providers — lives in <a href="https://github.com/chatwright/chatwright/blob/main/spec/features/chatwright/scenario-authoring/portable-scenario-documents/self-contained-scenario-documents/README.md">chatwright/chatwright's spec tree</a>. A dedicated <code>chatwright.dev/formats</code> page for it, matching <a href="/formats/run-bundle/v1">run-bundle</a> and <a href="/formats/chatwright-md/v1">CHATWRIGHT.md</a>, is not published yet.</li>
          <li>The bundle this command writes: <a href="/formats/run-bundle/v1">run-bundle format v1</a>.</li>
          <li>The unedited fixture used above: <a href="https://github.com/chatwright/runtime-go/blob/main/scenario/testdata/greetbot-language-onboarding.json">document</a> and <a href="https://github.com/chatwright/runtime-go/blob/main/scenario/testdata/cassettes/greetbot-language-onboarding.json">cassette</a>.</li>
        </ul>
      </article>
      <aside class="toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          <li><a href="#install">Install the CLI</a></li>
          <li><a href="#the-document">The document</a></li>
          <li><a href="#run-it">Run it</a></li>
          <li><a href="#replay">Replay it</a></li>
          <li><a href="#today">What's true today</a></li>
          <li><a href="#learn-more">Learn more</a></li>
        </ol>
      </aside>
    </main>
    ${renderFooter()}
  </body>
</html>`;
