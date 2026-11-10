import { renderHeader, renderFooter, chromeStyles, themeInitScript } from '../../chrome';

export const techStackPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <title>How Chatwright is built — tech stack</title>
    <meta name="description" content="How Chatwright connects executable recipes, two runtimes, a browser Studio and replayable evidence.">
    <link rel="canonical" href="https://chatwright.dev/about/tech-stack/">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"AboutPage","name":"How Chatwright is built","url":"https://chatwright.dev/about/tech-stack/","inLanguage":"en"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://chatwright.dev/"},{"@type":"ListItem","position":2,"name":"Tech stack","item":"https://chatwright.dev/about/tech-stack/"}]}]}</script>
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --faint:#8290a4; --line:#e5eaf0; --canvas:#fcfcfd; --card:#ffffff; --card-soft:#f7f9fb; --blue:#2c6dcc; --code-bg:#eef2f6; --code-ink:#1a2740; --accent:#0f766e; --accent-hover:#115e59; --accent-ink:#0d9488; --accent-tint-bg:#f0fdfa; --accent-tint-border:#99f6e4; --accent-tint-ink:#115e59; --nav-bg:rgba(252,252,253,.9); --nav-border:rgba(229,234,240,.9); --nav-hover-bg:#f2f5f8; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } body { margin:0; background:var(--canvas); color:var(--ink); line-height:1.65; } a { color:var(--accent-ink); } .wrap { max-width:1100px; margin:auto; padding-inline:1.5rem; } main { max-width:780px; padding-block:3.5rem 5rem; } .crumb { color:var(--soft); font-size:.9rem; } h1 { font-size:clamp(2rem,5vw,3.2rem); line-height:1.13; letter-spacing:-.04em; margin:1.3rem 0; } h2 { font-size:1.35rem; margin:2.5rem 0 .5rem; } p { max-width:68ch; } .lede { font-size:1.15rem; color:var(--soft); } .eyebrow { color:var(--accent-ink); font-size:.8rem; font-weight:750; letter-spacing:.1em; text-transform:uppercase; }
      ${chromeStyles}
    </style>
  </head>
  <body>
    ${renderHeader(null)}
    <main class="wrap">
      <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> / Tech stack</nav>
      <p class="eyebrow">Inside Chatwright</p>
      <h1>The tools behind a conversational UX run</h1>
      <p class="lede">A tech stack is the languages, libraries and services used to build a product. Chatwright connects a readable scenario to a run that can be replayed and checked, so a conversation design has evidence beside its words.</p>

      <h2>Recipes and runtimes</h2>
      <p>Recipes describe jobs and conversation patterns. A Chatwright scenario names the bot endpoint, actors, tasks and budgets. The <a href="https://github.com/chatwright/runtime-go">Go runtime</a> and <a href="https://github.com/chatwright/runtime-ts">TypeScript runtime</a> execute the same scenario contract, with platform support declared for each run. Telegram is the first supported platform; WhatsApp is in preview.</p>

      <h2>Evidence you can replay</h2>
      <p>The CLI writes a run bundle that records the conversation, judgments and verification results. Checked-in cassettes can replay an AI actor without a live model call. The <a href="/studio/player">browser player</a> opens a bundle locally, letting a reviewer inspect what happened without uploading the file.</p>

      <h2>This website and Studio</h2>
      <p>This public page is a prerendered TypeScript template. The <a href="/studio/">Studio</a> app uses Angular and PrimeNG for its editing and viewing interface. A build assembles both under one Cloudflare Workers static-assets origin, with Studio at <code>/studio/</code>.</p>

      <h2>Explore the source</h2>
      <p>Start with the <a href="/recipes">recipe catalogue</a>, follow the <a href="/quickstart">verified CLI quickstart</a>, or inspect the <a href="https://github.com/chatwright/studio">site and Studio source</a>.</p>
    </main>
    ${renderFooter()}
  </body>
</html>`;
