// Human-readable documentation for the run-bundle format v1, served at
// exactly https://chatwright.dev/formats/run-bundle/v1 (and its trailing-
// slash variant) — see ../../../index.ts. Content is sourced from
// chatwright/chatwright's bundle package godocs, docs/glossary.md's "Run
// bundles and playback" section and bundle/testdata/bundle_golden.json; see
// ./README.md for how schema.json alongside this file is kept in sync.
import { renderHeader, renderFooter, chromeStyles, themeInitScript } from '../../../chrome';

export const runBundleV1PageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <meta name="description" content="Run bundle format v1: the self-contained *.chatwright.json shape a Chatwright run is recorded in, and the URL every bundle's format field carries.">
    <title>Run bundle format v1 — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/formats/run-bundle/v1">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%230f766e'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%230f766e'/%3E%3C/svg%3E">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="Run bundle format v1 — Chatwright">
    <meta property="og:description" content="The self-contained *.chatwright.json shape a Chatwright run is recorded in, and the URL every bundle's format field carries.">
    <meta property="og:url" content="https://chatwright.dev/formats/run-bundle/v1">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Run bundle format v1 — Chatwright">
    <meta name="twitter:description" content="The self-contained *.chatwright.json shape a Chatwright run is recorded in, and the URL every bundle's format field carries.">
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
      .convlist { margin:1rem 0; padding:0; list-style:none; display:grid; gap:.7rem; }
      .convlist li { padding:.85rem 1rem; border:1px solid var(--line); border-radius:.6rem; background:var(--card); }
      .convlist strong { display:block; margin-bottom:.2rem; color:var(--ink); font-size:.92rem; }
      .convlist span { color:var(--soft); font-size:.88rem; line-height:1.6; }
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
        <p class="eyebrow">Formats · run-bundle · v1</p>
        <h1>Run bundle format v1</h1>
        <p class="lede">A run bundle is a single self-contained <code>*.chatwright.json</code> file recording one or more runs — journal, actors roster, parts, observations, loop events, report, evidence and annotations — replayable with no live Platform Emulator, no service and no network. It is identified by its format URL, never a bare version number.</p>
        <p class="self-id">This page's own address is that identifier: every bundle this format describes carries <code>"format": "https://chatwright.dev/formats/run-bundle/v1"</code> at its top level. A reader checks that string before trusting anything else in the file — see <a href="#versioning">Versioning</a>.</p>

        <h2 id="shape">The shape</h2>
        <p>A bundle is one JSON document. This section walks it top-down, each level with a small excerpt of its own shape — every excerpt below is elided (<code>"…"</code>) to the fields under discussion; see the <a href="#schema">schema</a> for the complete, exact shape.</p>

        <h3 id="top-level">Top level</h3>
        <figure><pre><code>{
  "format": "https://chatwright.dev/formats/run-bundle/v1",
  "metadata": { "…": "…" },
  "runs": [ { "…": "…" } ]
}</code></pre></figure>
        <p>Three required keys, always. <code>format</code> is the version identifier (see <a href="#versioning">Versioning</a>). <code>metadata</code> is the bundle's own provenance — who assembled it and when — independent of any one run. <code>runs</code> is every run the bundle carries, in the order the caller assembled them; today's writers always emit exactly one, but the shape accommodates several campaigns bundled for one delivery without a schema change.</p>

        <h3 id="metadata">Metadata</h3>
        <figure><pre><code>"metadata": {
  "createdAt": "2026-07-22T12:00:00Z",
  "chatwrightVersion": "v0.4.1",
  "author": { "name": "Ada Reviewer", "email": "ada@chatwright.dev" }
}</code></pre></figure>
        <p><code>createdAt</code> is always caller-supplied, never stamped from wall-clock time internally, so assembling a bundle is itself deterministic and testable. <code>chatwrightVersion</code> is the resolved <code>chatwright</code> module version, left empty when it can't be determined (for example, a <code>go test</code> run inside the chatwright module itself). <code>author</code> is optional and, like every author field a bundle carries, is <strong>never populated automatically</strong> from git config, the OS user or any other ambient identity — bundles get emailed and committed to public repositories, so silently harvesting an identity into one isn't made for you; a caller supplies it explicitly or leaves it out.</p>

        <h3 id="runs">Runs</h3>
        <figure><pre><code>{
  "id": "run-1",
  "platform": "telegram",
  "endpointProfile": "platform-emulated",
  "actors": [ { "…": "…" } ],
  "chats": [ { "…": "…" } ],
  "parts": [ { "…": "…" } ],
  "bookmarks": [ { "…": "…" } ],
  "annotations": [ { "…": "…" } ]
}</code></pre></figure>
        <p>A run is one execution, in one environment, with one declared endpoint profile. <code>id</code> only needs to be unique within the bundle. <code>platform</code> names the platform driven (e.g. <code>"telegram"</code>). <code>endpointProfile</code> declares the execution boundary — see <a href="#conventions">Fidelity</a> below. <code>actors</code>, <code>chats</code> and <code>parts</code> are the required core; <code>bookmarks</code> and <code>annotations</code> are optional and omitted entirely when a writer has none to attach.</p>

        <h3 id="actors">Actors roster</h3>
        <figure><pre><code>{
  "id": "explorer",
  "type": "ai-agent",
  "name": "Explorer",
  "platformIdentities": {
    "telegram": { "userId": 7, "username": "explorer_bot", "firstName": "Explorer" }
  },
  "provider": { "name": "anthropic", "modelIds": [ "claude-haiku-4-5" ] }
}</code></pre></figure>
        <p>The roster lists every participant, so a player can attribute every journal entry and every loop event back to whoever actually produced it, rather than inferring it. Five actor types:</p>
        <ul>
          <li><strong>ai-agent</strong> — an AI model proposing actions via a provider.</li>
          <li><strong>human</strong> — a person driving the conversation directly.</li>
          <li><strong>scripted</strong> — a fixed, deterministic proposal sequence or scenario fragment.</li>
          <li><strong>replay</strong> — a recorded run replayed from a provider cassette.</li>
          <li><strong>bot</strong> — the bot under test itself, the other side of the conversation.</li>
        </ul>
        <p><code>platformIdentities</code> maps a platform name to that actor's platform-native identity on it — a map, not a single field, so an actor active across more than one platform needs no schema change. <code>provider</code> (name plus the aggregated <code>modelIds</code> that actually proposed an action) is only meaningful for <code>ai-agent</code> and <code>replay</code> actors; a scripted or human actor proposes nothing a "provider" describes.</p>

        <h3 id="chats">Chats and journal entries</h3>
        <figure><pre><code>{
  "direction": "bot",
  "kind": "message",
  "messageId": 2,
  "refMessageId": 0,
  "version": 0,
  "text": "Choose your language:",
  "fromId": 1,
  "at": "2026-07-22T12:00:01Z"
},
{
  "direction": "bot",
  "kind": "message",
  "messageId": 2,
  "refMessageId": 0,
  "version": 1,
  "text": "Howdy stranger",
  "fromId": 1,
  "at": "2026-07-22T12:00:03Z"
}</code></pre></figure>
        <p><code>chats</code> is the run's continuous, per-chat journal: one entry per distinct chat id, carrying that chat's entire history for the whole run — a part never re-splits or duplicates it, only slices it by reference (see <a href="#parts">Parts</a>). Every field is camelCase. <code>direction</code> (<code>user</code> | <code>bot</code>) and <code>kind</code> (<code>message</code> | <code>action</code> | <code>uncaptured</code>) are string-constant enums, never integers. <code>messageId</code> together with <code>version</code> is versioned message identity: the two entries above are the same logical message, its second version replacing the first after an edit — a player renders both, not just the latest. <code>refMessageId</code> points at what an entry replies to or acts on. <code>fromId</code> is the platform-native id of whoever produced the entry, resolvable against a roster actor's <code>platformIdentities</code>.</p>

        <h3 id="parts">Parts</h3>
        <figure><pre><code>{
  "id": "exploration",
  "title": "Shopping-list exploration",
  "kind": "ai-goal",
  "journalBoundary": {
    "chats": [ { "chatId": 42, "firstEntry": 0, "entryCount": 4 } ]
  },
  "aiGoal": { "…": "…" }
}</code></pre></figure>
        <p>A part is one ordered passage of a run: a declared <code>kind</code>, a <code>journalBoundary</code> slicing the run-level journal into the entries that part covers, and a kind-scoped section carrying that passage's own detail. <code>journalBoundary.chats</code> is a half-open range per chat — <code>[firstEntry, firstEntry + entryCount)</code> — never a duplicated copy of the entries themselves. Two kinds exist: <code>ai-goal</code>, with a writer today (see below), and <code>deterministic</code>, reserved for the hybrid-runs runtime — the kind value already round-trips, but no <code>deterministic</code> section is modelled yet. Today's writers always emit exactly one <code>ai-goal</code> part spanning the whole journal; the ordered-list shape is what lets a future hybrid run (deterministic passages interleaved with AI-goal exploration) add more parts without any schema change.</p>

        <h3 id="ai-goal">The aiGoal section</h3>
        <figure><pre><code>"aiGoal": {
  "goal": { "id": "listus", "title": "Exercise onboarding", "…": "…" },
  "actorId": "explorer",
  "events": [ { "…": "…" } ],
  "observations": [ { "…": "…" } ],
  "report": { "…": "…" },
  "evidence": [ { "…": "…" } ]
}</code></pre></figure>
        <p>Populated whenever a part's <code>kind</code> is <code>ai-goal</code>. <code>goal</code> is the goal/task contract that part's actor loop ran, carried verbatim — task dependencies, constraints and budgets included, not reduced to the plain-string summary <code>report</code> gives. <code>actorId</code> references the roster actor that ran the loop. <code>events</code> is every loop step (propose → validate → act), in order. <code>observations</code> is every observation the loop retained, ascending by sequence. <code>report</code> is the assembled campaign report: stop reason, per-task status, findings and aggregate usage. <code>evidence</code> is any data-state assertions the part ran, in execution order — omitted entirely when a part asserted none.</p>

        <h3 id="bookmarks-annotations">Bookmarks and annotations</h3>
        <figure><pre><code>"annotations": [
  {
    "id": "note-1",
    "anchor": { "chatId": 42, "entryIndex": 3, "messageId": 2, "version": 1 },
    "author": { "name": "Ada Reviewer", "email": "ada@chatwright.dev" },
    "createdAt": "2026-07-22T12:00:10Z",
    "text": "See how instead of $4 bot returned 4$"
  },
  {
    "id": "note-2",
    "anchor": { "chatId": 42, "entryIndex": 3, "messageId": 2, "version": 1 },
    "createdAt": "2026-07-22T12:00:20Z",
    "text": "Good catch — filed as a display bug.",
    "replyTo": "note-1"
  }
]</code></pre></figure>
        <p>Both anchor into the journal via the same shape — <code>{ chatId, entryIndex, messageId?, version? }</code>. <code>chatId</code> and <code>entryIndex</code> are required; <code>messageId</code> and <code>version</code> are optional and, together, pin an exact edited revision rather than whatever a message's latest wording happens to be by the time a player renders it. A <strong>bookmark</strong> is a manual fast-forward marker for a moment a player can't already derive on its own — part boundaries, task completions and findings are all recoverable from a run's own parts, so a bookmark exists only for the rest. An <strong>annotation</strong> is a comment anchored to a moment, optionally threaded onto another annotation via <code>replyTo</code> (a root annotation leaves it empty, as <code>note-1</code> does above).</p>
        <div class="note"><strong>Read-side tolerance.</strong> A <code>replyTo</code> naming an annotation id the run doesn't actually carry, and an anchor whose <code>entryIndex</code> (or <code>messageId</code>/<code>version</code>) doesn't resolve against the referenced chat, are both <em>not</em> errors: bundles are hand-editable files, and a consumer must be prepared to surface a dangling reference rather than assume it was already validated on read.</div>

        <h2 id="conventions">Conventions</h2>
        <ul class="convlist">
          <li><strong>Uniformly camelCase</strong><span>Every field name on the whole wire — nested types included — is camelCase. Nothing falls back to a language default's own casing.</span></li>
          <li><strong>Enums are string constants</strong><span>Direction, journal-entry kind, verdict, actor, change kind, proposal kind and action-outcome kind are all human-readable strings (<code>"user"</code>, <code>"message"</code>, <code>"fresh"</code>, …) — never a bare integer.</span></li>
          <li><strong>Deterministic JSON</strong><span>A bundle is always written as two-space-indented JSON terminated by a trailing newline, with declared field order and sorted map keys — two encodings of equal data are byte-identical, so a bundle diffs cleanly in a pull request.</span></li>
          <li><strong><code>*.chatwright.json</code> filenames</strong><span>A bundle file is named <code>&lt;anything&gt;.chatwright.json</code> (e.g. <code>greetbot-language.chatwright.json</code>), so a player, file browser or directory listing recognises one at a glance.</span></li>
          <li><strong>Cassettes are never embedded</strong><span>An AI actor's provider cassette — its recorded prompt/response history, keyed by provider config and prompt hash — is a separate artefact, reused as a replay cache across many runs rather than owned by any one of them. A bundle records what happened in the conversation; it never carries a copy of the cassette that made an AI actor's part of it replayable at zero token cost.</span></li>
          <li><strong>Fidelity is declared</strong><span>Each run's <code>endpointProfile</code> names its execution boundary (e.g. <code>"platform-emulated"</code>, today's strongest). Evidence gathered under one profile is never interchangeable with evidence gathered under another — a reader always knows exactly how strong a bundle's evidence is, never a "full platform" claim by implication.</span></li>
        </ul>

        <h2 id="versioning">Versioning</h2>
        <p>The format URL <strong>is</strong> the version. <code>https://chatwright.dev/formats/run-bundle/v1</code> — this page's own address — is the only version identifier a bundle carries; a bare number such as <code>"1"</code> or <code>"v1"</code> is never valid on its own.</p>
        <p>A reader rejects any other value outright, naming what it found instead of guessing at an older or newer shape it might not agree with — a hypothetical future format is exactly as rejected as a stale draft one.</p>
        <p>Within v1, evolution is additive only: unknown extra fields anywhere in the document are ignored on read, so a bundle written by a future minor release that only <em>adds</em> fields still reads cleanly today. A breaking change earns a new URL — v2 — never a silent reinterpretation of what v1 already means.</p>

        <h2 id="schema">Schema and reference consumer</h2>
        <p>The complete shape is also published as a machine-readable <a href="/formats/run-bundle/v1/schema.json">JSON Schema</a> (draft 2020-12), generated directly from the Go types that define this format and checked against both a golden bundle and a real end-to-end-produced one.</p>
        <p>The schema is intentionally <em>stricter</em> than a reader in two ways it's worth knowing about: it closes every enum (a value outside the listed set fails schema validation, even though a reader still accepts a hand-edited one) and it rejects any property it doesn't declare on every object — whereas a reader forward-compatibly ignores unknown fields, exactly as <a href="#versioning">Versioning</a> above describes. The schema describes today's exact shape; it is not itself the compatibility promise — that's what <a href="#versioning">Versioning</a> states. Like a reader, the schema never validates bookmark or annotation references: a dangling <code>replyTo</code> or anchor stays a consumer's concern either way.</p>
        <p>The reference consumer is the <a href="/studio/">Chatwright Studio player</a>: drop a <code>.chatwright.json</code> file in and it replays entirely client-side — nothing is uploaded.</p>
      </article>
      <aside class="toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          <li><a href="#shape">The shape</a></li>
          <li><a href="#top-level">Top level</a></li>
          <li><a href="#metadata">Metadata</a></li>
          <li><a href="#runs">Runs</a></li>
          <li><a href="#actors">Actors roster</a></li>
          <li><a href="#chats">Chats &amp; journal</a></li>
          <li><a href="#parts">Parts</a></li>
          <li><a href="#ai-goal">aiGoal section</a></li>
          <li><a href="#bookmarks-annotations">Bookmarks &amp; annotations</a></li>
          <li><a href="#conventions">Conventions</a></li>
          <li><a href="#versioning">Versioning</a></li>
          <li><a href="#schema">Schema &amp; player</a></li>
        </ol>
      </aside>
    </main>
    ${renderFooter()}
  </body>
</html>`;
