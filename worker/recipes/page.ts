// Human-readable rendering of the Chatwright knowledge graph — Jobs, Recipes,
// Implementations and the federation registry — served at exactly
// https://chatwright.dev/recipes (and its trailing-slash variant); see
// ../index.ts. Content comes from ./data.ts, a hand-embedded snapshot of
// chatwright/recipes (see that file's header comment for the sync
// disclaimer and worker/formats/*/v1/page.ts for the inline-HTML doc-page
// pattern this follows: shared nav/footer styling, a single exported
// String.raw document).
import { jobs, recipes, registryEntries, recipesSourceCommit, type ImplementationTier, type Recipe } from './data';

const tierLabel: Record<ImplementationTier, string> = {
  official: 'official',
  alternative: 'alternative',
  community: 'community'
};

const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
const jobById = new Map(jobs.map((job) => [job.id, job]));

function renderChips(values: readonly string[], extraClass = ''): string {
  return values.map((value) => `<span class="chip${extraClass ? ` ${extraClass}` : ''}">${value}</span>`).join('');
}

function renderImplementations(implementations: readonly Recipe['implementations'][number][]): string {
  return implementations
    .map(
      (implementation) =>
        `<li class="impl-row"><span class="tier-badge tier-${implementation.tier}">${tierLabel[implementation.tier]}</span><span class="impl-title">${implementation.title}</span><span class="impl-platform">${implementation.platform}</span></li>`
    )
    .join('');
}

function renderRecipeCard(recipe: Recipe): string {
  const jobLinks = recipe.jobIds
    .map((jobId) => {
      const job = jobById.get(jobId);
      const title = job ? job.title : jobId;
      return `<a href="#job-${jobId}">${title}</a>`;
    })
    .join(', ');

  const snippetsMarkup =
    recipe.snippets.length > 0
      ? `<div class="snippet-row"><span class="snippet-row-label">Code</span><div class="chip-row">${renderChips(
          recipe.snippets.map((snippet) => snippet.label),
          'chip-snippet'
        )}</div></div>`
      : '';

  const runLiveMarkup = recipe.runLive
    ? `<a class="button-mini button-mini-live" href="${recipe.runLive}">Run it live →</a>`
    : '';

  return `<article class="recipe-card" id="recipe-${recipe.id}">
          <div class="recipe-card-head"><h3>${recipe.title}</h3><span class="status-badge status-${recipe.status}">${recipe.status}</span></div>
          <p class="recipe-jobs">Solves ${jobLinks}</p>
          <div class="chip-row">${renderChips(recipe.tags)}</div>
          <ul class="impl-list">${renderImplementations(recipe.implementations)}</ul>
          ${snippetsMarkup}
          ${recipe.watch
            ? `<p class="card-actions"><a class="button-mini" href="${recipe.watch}">▶ Watch it run</a>${runLiveMarkup}<span class="card-actions-note">a real recorded run, replayed in the player</span></p>`
            : `<p class="card-actions card-actions-note">▶ Live start lands with the browser Playground — recording wanted meanwhile</p>`}
          <a class="card-link" href="${recipe.githubUrl}">View “${recipe.title}” on GitHub →</a>
        </article>`;
}

function renderJobRow(job: (typeof jobs)[number]): string {
  const solvedLinks = job.solvedBy
    .map((recipeId) => {
      const recipe = recipeById.get(recipeId);
      const title = recipe ? recipe.title : recipeId;
      return `<a href="#recipe-${recipeId}">${title} →</a>`;
    })
    .join(', ');

  const solvedMarkup =
    job.solvedBy.length > 0
      ? `<span class="job-solved">${solvedLinks}</span>`
      : `<a class="job-wanted" href="https://github.com/chatwright/recipes/blob/main/CONTRIBUTING.md">Recipe wanted — contribute one →</a>`;

  return `<li class="job-row" id="job-${job.id}"><span class="job-title">${job.title}</span>${solvedMarkup}</li>`;
}

function renderRegistryRow(entry: (typeof registryEntries)[number]): string {
  const repoLabel = entry.repo.replace('https://github.com/', '');
  const specFirstChip = entry.specFirst ? '<span class="chip chip-specfirst">spec-first</span>' : '';

  return `<li class="registry-row">
          <div class="registry-repo"><a href="${entry.repo}">${repoLabel}</a>${specFirstChip}</div>
          <a class="badge-link" href="/try/github/${repoLabel}" aria-label="Try ${repoLabel} in Chatwright"><img src="/badge.svg" width="132" height="20" alt="Try in Chatwright"></a>
        </li>`;
}

const recipeCardsMarkup = recipes.map(renderRecipeCard).join('\n        ');
const jobRowsMarkup = jobs.map(renderJobRow).join('\n        ');
const registryRowsMarkup = registryEntries.map(renderRegistryRow).join('\n        ');

export const recipesPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="description" content="Recipes for conversational UX. Every recipe runs. Jobs, Recipes and Implementations from the Chatwright knowledge graph — collect an RSVP, onboard a user in their language, and the federation registry of independently owned bots.">
    <title>Recipes — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/recipes">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%2350cba0'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%2350cba0'/%3E%3C/svg%3E">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="Recipes — Chatwright">
    <meta property="og:description" content="Recipes for conversational UX. Every recipe runs. Jobs, Recipes and Implementations from the Chatwright knowledge graph.">
    <meta property="og:url" content="https://chatwright.dev/recipes">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Recipes — Chatwright">
    <meta name="twitter:description" content="Recipes for conversational UX. Every recipe runs.">
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
      .doc { max-width:46rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(1.5rem,3vw,2.5rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.05; letter-spacing:-.045em; }
      .lede { max-width:44rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .graph-line { display:inline-flex; flex-wrap:wrap; align-items:center; gap:.4rem; margin:1.1rem 0 0; padding:.7rem .9rem; border:1px solid var(--line); border-radius:.5rem; background:#fff; color:var(--ink); font:650 .9rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .graph-line span.dim { color:var(--soft); font-weight:500; }
      section.block { padding:clamp(1.75rem,4vw,2.75rem) 0; border-top:1px solid var(--line); }
      section.block > .wrap > h2 { margin:0 0 .35rem; font-size:1.5rem; letter-spacing:-.03em; }
      section.block > .wrap > p.block-lede { margin:0 0 1.5rem; color:var(--soft); font-size:.94rem; line-height:1.6; max-width:46rem; }
      .recipe-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(20rem,1fr)); gap:1.25rem; }
      .recipe-card { padding:1.4rem 1.5rem 1.6rem; border:1px solid var(--line); border-radius:.75rem; background:#fff; scroll-margin-top:5.5rem; }
      .recipe-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:.75rem; }
      .recipe-card-head h3 { margin:0; font-size:1.18rem; letter-spacing:-.02em; }
      .recipe-jobs { margin:.4rem 0 0; color:var(--soft); font-size:.85rem; } .recipe-jobs a { color:var(--mint-ink); font-weight:600; text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; }
      .status-badge { flex:0 0 auto; padding:.2rem .55rem; border-radius:999px; font:700 .68rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.04em; }
      .status-draft { color:#8a5a06; background:#fdf0d6; }
      .chip-row { display:flex; flex-wrap:wrap; gap:.4rem; margin:.85rem 0 0; }
      .chip { padding:.22rem .58rem; border:1px solid var(--line); border-radius:999px; color:var(--soft); background:#f7f9fb; font-size:.74rem; font-weight:600; }
      .chip-snippet { color:var(--blue); background:#eef4fd; border-color:#d3e3fa; }
      .card-actions { display:flex; align-items:center; gap:.6rem; margin:.9rem 0 0; }
      .button-mini { display:inline-block; padding:.42rem .85rem; border-radius:8px; background:var(--mint,#37b884); color:#06271d; font-weight:700; font-size:.8rem; text-decoration:none; }
      .button-mini-live { background:#fff; color:var(--blue); border:1px solid #b7cdf2; }
      .card-actions-note { color:#718094; font-size:.76rem; }
      .chip-specfirst { color:var(--mint-ink); background:#effbf5; border-color:#bce9d8; }
      .impl-list { list-style:none; margin:1rem 0 0; padding:0; display:grid; gap:.5rem; }
      .impl-row { display:flex; flex-wrap:wrap; align-items:center; gap:.55rem; padding:.55rem .7rem; border:1px solid var(--line); border-radius:.5rem; background:#fbfcfd; font-size:.86rem; }
      .impl-title { color:var(--ink); font-weight:620; }
      .impl-platform { margin-left:auto; color:var(--soft); font-size:.78rem; }
      .tier-badge { flex:0 0 auto; padding:.15rem .5rem; border-radius:.35rem; font:700 .66rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.03em; }
      .tier-official { color:#0d5e49; background:#dcf5ea; }
      .tier-alternative { color:#1a3f8a; background:#e1eafd; }
      .tier-community { color:#6b4b16; background:#faeccb; }
      .snippet-row { display:flex; flex-wrap:wrap; align-items:center; gap:.6rem; margin:1rem 0 0; }
      .snippet-row-label { color:#8290a4; font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.08em; text-transform:uppercase; }
      .card-link { display:inline-block; margin:1.15rem 0 0; color:var(--mint-ink); font-weight:650; font-size:.87rem; text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; }
      .card-link:hover { text-decoration-color:currentColor; }
      .jobs-list { list-style:none; margin:0; padding:0; display:grid; gap:.6rem; }
      .job-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; padding:.85rem 1rem; border:1px solid var(--line); border-radius:.6rem; background:#fff; scroll-margin-top:5.5rem; }
      .job-title { font-weight:640; }
      .job-solved a { color:var(--mint-ink); font-weight:650; font-size:.87rem; text-decoration:none; } .job-solved a:hover { text-decoration:underline; }
      .job-wanted { color:var(--blue); font-weight:650; font-size:.87rem; text-decoration:none; border:1px dashed #b7cdf2; border-radius:.4rem; padding:.28rem .6rem; } .job-wanted:hover { text-decoration:underline; }
      .registry-list { list-style:none; margin:0; padding:0; display:grid; gap:.6rem; }
      .registry-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; padding:.85rem 1rem; border:1px solid var(--line); border-radius:.6rem; background:#fff; }
      .registry-repo { display:flex; flex-wrap:wrap; align-items:center; gap:.55rem; font-weight:640; }
      .registry-repo a { color:var(--mint-ink); text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; }
      .badge-link { display:inline-flex; line-height:0; }
      .badge-link img { display:block; }
      .cta-row { display:flex; flex-wrap:wrap; gap:.7rem; margin-top:.3rem; }
      footer { padding:2.5rem 0 3rem; color:#718094; font-size:.78rem; } footer .wrap { display:flex; justify-content:space-between; gap:1rem; border-top:1px solid var(--line); padding-top:1.45rem; } footer a { color:var(--soft); text-decoration:none; }
      .foot-left { display:flex; flex-direction:column; gap:.35rem; }
      .foot-note code { padding:.05rem .32rem; border-radius:.3rem; background:#eef3f8; color:var(--mint-ink); font-size:.72rem; }
      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } .nav > .wrap { min-height:64px; } .links { display:none; } .brand small { display:none; } footer .wrap { align-items:flex-start; flex-direction:column; } .job-row, .registry-row { flex-direction:column; align-items:flex-start; } }
    </style>
  </head>
  <body>
    <header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Chatwright home">Chatwright <small>by sneat.dev</small></a><nav class="links" aria-label="Primary navigation"><a href="/">Home</a><a href="/studio/">Studio</a><a href="https://github.com/chatwright/chatwright">GitHub</a></nav><a class="button primary" href="/studio/">Open Studio</a></div></header>
    <main>
      <div class="wrap doc">
        <p class="eyebrow">Jobs · Recipes · Implementations</p>
        <h1>Recipes for conversational UX. Every recipe runs.</h1>
        <p class="lede">This is the Chatwright knowledge graph, rendered: one connected graph, several ways in — a problem you have, a capability you need, or a bot you already built.</p>
        <p class="graph-line">Job <span class="dim">solved by</span> → Recipe <span class="dim">realised by</span> → Implementation <span class="dim">on a</span> Platform <span class="dim">using</span> Capabilities</p>
      </div>

      <section class="block" id="recipes"><div class="wrap">
        <h2>Recipes</h2>
        <p class="block-lede">Executable answers to a Job — an annotated conversation, several honestly-compared Implementations, and code you can run today.</p>
        <div class="recipe-grid">
        ${recipeCardsMarkup}
        </div>
      </div></section>

      <section class="block" id="jobs"><div class="wrap">
        <h2>Jobs</h2>
        <p class="block-lede">What someone wants to accomplish. A Job with no Recipe yet is an open invitation, not a dead end.</p>
        <ul class="jobs-list">
        ${jobRowsMarkup}
        </ul>
      </div></section>

      <section class="block" id="registry"><div class="wrap">
        <h2>Registered repositories</h2>
        <p class="block-lede">Independently owned repositories that federate in with their own <a href="/formats/chatwright-md/v1">CHATWRIGHT.md</a> manifest — no registration required to earn the badge, listing here is the optional discovery layer on top.</p>
        <ul class="registry-list">
        ${registryRowsMarkup}
        </ul>
      </div></section>

      <section class="block" id="contribute"><div class="wrap">
        <h2>Add to the graph</h2>
        <p class="block-lede">Three ways in — write a Recipe for a Job that doesn't have one, register a bot you already run, or start a new one from a working skeleton.</p>
        <div class="cta-row">
          <a class="button primary" href="https://github.com/chatwright/recipes">Contribute recipes →</a>
          <a class="button quiet" href="https://github.com/chatwright/recipes/blob/main/registry/README.md">Register your bot →</a>
          <a class="button quiet" href="https://github.com/chatwright/bot-template">Start from the template →</a>
        </div>
      </div></section>
    </main>
    <footer><div class="wrap"><div class="foot-left"><span>An independent open-source project by Sneat.co</span><span class="foot-note">Rendered from chatwright/recipes@<code>${recipesSourceCommit}</code> — automated content pipeline is research item I-72.</span></div><a href="https://sneat.dev/">Explore sneat.dev →</a></div></footer>
  </body>
</html>`;
