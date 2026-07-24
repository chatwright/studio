// Human-readable pricing page — served at exactly https://chatwright.dev/pricing
// (and its trailing-slash variant); see ../index.ts. This is deliberately
// thin: Chatwright has no pricing or checkout of its own — it is bundled
// into the sneat.work subscription, so every card's call to action leaves
// this page. Content comes from ./data.ts (see that file's header comment
// for the two-source provenance disclaimer). Follows the same inline-HTML
// doc-page pattern as worker/formats/*/v1/page.ts and worker/recipes/page.ts:
// shared nav/footer styling, a single exported String.raw document.
import {
  pricingTiers,
  lifetimeOffer,
  contactLine,
  aiCreditsLine,
  freeForeverItems,
  quotaRows,
  freeLocalPathSentence,
  type PricingTier
} from './data';
import { renderHeader, renderFooter, chromeStyles } from '../chrome';

const unitLabel: Record<PricingTier['unit'], string> = {
  account: 'per account',
  seat: 'per seat'
};

function renderTierCard(tier: PricingTier): string {
  const featuresMarkup = tier.features.map((feature) => `<li>${feature}</li>`).join('');
  return `<article class="tier-card" id="tier-${tier.id}">
          <div class="tier-head"><h3>${tier.name}</h3><span class="unit-badge">${unitLabel[tier.unit]}</span></div>
          <p class="tier-price">${tier.price}<span class="tier-price-note">${tier.priceNote}</span></p>
          <ul class="tier-features">${featuresMarkup}</ul>
          <a class="button primary tier-cta" href="${tier.cta.href}">${tier.cta.label}</a>
        </article>`;
}

function renderFreeForeverItem(item: string): string {
  return `<li class="ff-item">${item}</li>`;
}

function renderQuotaRow(row: (typeof quotaRows)[number]): string {
  return `<tr><th scope="row">${row.feature}</th><td>${row.counts}</td><td>${row.alwaysFree}</td></tr>`;
}

const tierCardsMarkup = pricingTiers.map(renderTierCard).join('\n          ');
const freeForeverMarkup = freeForeverItems.map(renderFreeForeverItem).join('');
const quotaRowsMarkup = quotaRows.map(renderQuotaRow).join('\n              ');
const lifetimeFeaturesMarkup = lifetimeOffer.features.map((feature) => `<li>${feature}</li>`).join('');

export const pricingPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="description" content="Chatwright is included in your sneat.work subscription. The complete local stack — CLI, runtime, Studio, Playground, Player, BYOK AI-testing — is free forever, no account. Cloud features (saved recordings, team sharing, hosted AI-testing) come with sneat.work: Free, Pro $9, Team $29, Company $9/seat.">
    <title>Pricing — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/pricing">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%2350cba0'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%2350cba0'/%3E%3C/svg%3E">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="Pricing — Chatwright">
    <meta property="og:description" content="Chatwright is included in your sneat.work subscription. The complete local stack is free forever, no account — Cloud features come with sneat.work.">
    <meta property="og:url" content="https://chatwright.dev/pricing">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Pricing — Chatwright">
    <meta name="twitter:description" content="Chatwright is included in your sneat.work subscription. The complete local stack is free forever, no account.">
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --line:#e5eaf0; --canvas:#fcfcfd; --blue:#2c6dcc; --mint:#50cba0; --mint-ink:#0d5e49; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      ${chromeStyles}
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#06271d; background:var(--mint); box-shadow:0 8px 20px rgba(80,203,160,.17); } .quiet { border-color:var(--line); background:#fff; }
      .doc { max-width:46rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(1rem,3vw,1.5rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2.1rem,3.6vw,2.85rem); line-height:1.1; letter-spacing:-.045em; }
      .lede { max-width:44rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      section.block { padding:clamp(1.75rem,4vw,2.75rem) 0; border-top:1px solid var(--line); }
      section.block > .wrap > h2 { margin:0 0 .35rem; font-size:1.5rem; letter-spacing:-.03em; }
      section.block > .wrap > p.block-lede { margin:0 0 1.5rem; color:var(--soft); font-size:.94rem; line-height:1.6; max-width:46rem; }

      .free-panel { padding:1.75rem 1.9rem 2rem; border:1px solid #bce9d8; border-radius:1rem; background:#effbf5; }
      .free-panel-head { display:flex; flex-wrap:wrap; align-items:baseline; gap:.6rem .9rem; }
      .free-panel-head h2 { margin:0; color:var(--mint-ink); font-size:1.4rem; letter-spacing:-.03em; }
      .free-panel-tag { padding:.22rem .6rem; border-radius:999px; color:#06271d; background:var(--mint); font:700 .68rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.04em; }
      .free-panel p.block-lede { margin:.6rem 0 1.3rem; color:#20614c; }
      .ff-list { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); gap:.6rem; }
      .ff-item { display:flex; align-items:center; gap:.55rem; padding:.7rem .85rem; border:1px solid #bce9d8; border-radius:.55rem; background:#fff; color:var(--ink); font-weight:620; font-size:.92rem; }
      .ff-item::before { content:"✓"; flex:0 0 auto; color:var(--mint-ink); font-weight:800; }
      .ff-note { margin:1.3rem 0 0; color:#20614c; font-size:.88rem; font-weight:650; }

      .tier-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(15.5rem,1fr)); gap:1.1rem; }
      .tier-card { display:flex; flex-direction:column; padding:1.4rem 1.5rem 1.6rem; border:1px solid var(--line); border-radius:.75rem; background:#fff; }
      .tier-head { display:flex; align-items:baseline; justify-content:space-between; gap:.6rem; }
      .tier-head h3 { margin:0; font-size:1.18rem; letter-spacing:-.02em; }
      .unit-badge { flex:0 0 auto; padding:.16rem .5rem; border-radius:999px; color:var(--soft); background:#f7f9fb; border:1px solid var(--line); font:650 .66rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.03em; }
      .tier-price { margin:.75rem 0 0; font-size:1.7rem; font-weight:750; letter-spacing:-.03em; }
      .tier-price-note { display:block; margin-top:.15rem; color:var(--soft); font-size:.76rem; font-weight:600; letter-spacing:0; }
      .tier-features { list-style:none; margin:1.1rem 0 0; padding:0; display:grid; gap:.55rem; flex:1 1 auto; }
      .tier-features li { position:relative; padding-left:1.15rem; color:var(--soft); font-size:.85rem; line-height:1.5; }
      .tier-features li::before { content:"—"; position:absolute; left:0; color:#9fb0c6; }
      .tier-cta { margin-top:1.3rem; width:100%; }

      .lifetime-card { margin-top:1.25rem; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:1.5rem; padding:1.5rem 1.75rem; border:1px solid #bce9d8; border-radius:.85rem; background:linear-gradient(135deg,#effbf5,#fff); }
      .lifetime-badge { display:inline-block; margin:0 0 .5rem; padding:.2rem .58rem; border-radius:999px; color:#06271d; background:var(--mint); font:700 .68rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.04em; }
      .lifetime-card h3 { margin:0; font-size:1.25rem; letter-spacing:-.02em; }
      .lifetime-price { margin:.5rem 0 0; font-size:1.6rem; font-weight:750; letter-spacing:-.03em; } .lifetime-price span { margin-left:.4rem; color:var(--soft); font-size:.78rem; font-weight:600; }
      .lifetime-features { list-style:none; margin:.85rem 0 0; padding:0; display:grid; gap:.4rem; }
      .lifetime-features li { position:relative; padding-left:1.15rem; color:var(--soft); font-size:.85rem; line-height:1.5; }
      .lifetime-features li::before { content:"—"; position:absolute; left:0; color:#9fb0c6; }
      .lifetime-cta-col { text-align:right; }
      @media (max-width:640px) { .lifetime-card { grid-template-columns:1fr; text-align:left; } .lifetime-cta-col { text-align:left; } }

      .ladder-foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem; margin-top:1.5rem; padding-top:1.35rem; border-top:1px solid var(--line); }
      .contact-line { margin:0; color:var(--soft); font-size:.92rem; } .contact-line a { color:var(--mint-ink); font-weight:650; text-decoration:underline; text-decoration-color:rgba(13,94,73,.3); text-underline-offset:.15em; } .contact-line a:hover { text-decoration-color:currentColor; }
      .credits-line { margin:0; padding:.75rem .95rem; border:1px solid var(--line); border-left:3px solid var(--blue); border-radius:0 .45rem .45rem 0; background:#fff; color:var(--soft); font-size:.88rem; line-height:1.6; }

      .quota-table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:.7rem; background:#fff; }
      table.quota-table { width:100%; border-collapse:collapse; font-size:.86rem; }
      table.quota-table th, table.quota-table td { padding:.85rem 1rem; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
      table.quota-table thead th { color:#8290a4; font:700 .68rem/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-transform:uppercase; letter-spacing:.06em; background:#f7f9fb; }
      table.quota-table tbody th[scope="row"] { color:var(--ink); font-weight:650; white-space:nowrap; }
      table.quota-table tbody td { color:var(--soft); line-height:1.55; }
      table.quota-table tbody tr:last-child th, table.quota-table tbody tr:last-child td { border-bottom:none; }
      .quota-note { margin:1.1rem 0 0; padding:.75rem .95rem; border:1px solid #bce9d8; border-left:3px solid var(--mint-ink); border-radius:0 .45rem .45rem 0; background:#effbf5; color:#20614c; font-size:.9rem; font-weight:600; line-height:1.6; }

      @media (max-width:720px) { .wrap { width:min(100% - 2rem,1180px); } .ladder-foot { flex-direction:column; align-items:flex-start; } }
    </style>
  </head>
  <body>
    ${renderHeader('pricing')}
    <main>
      <div class="wrap doc">
        <p class="eyebrow">Pricing</p>
        <h1>Chatwright is included in your sneat.work subscription.</h1>
        <p class="lede">One subscription covers the whole Sneat work suite — Chatwright's Cloud features (saved recordings, team sharing, hosted AI testing) come with it. There is no separate Chatwright checkout.</p>
      </div>

      <section class="block" id="free-forever"><div class="wrap">
        <div class="free-panel">
          <div class="free-panel-head"><h2>Free forever, no account</h2><span class="free-panel-tag">Local stack</span></div>
          <p class="block-lede">The complete local stack works today, offline, with no signup and no card — on every plan, including no plan at all.</p>
          <ul class="ff-list">${freeForeverMarkup}</ul>
          <p class="ff-note">Unlimited on every plan — including no plan at all.</p>
        </div>
      </div></section>

      <section class="block" id="ladder"><div class="wrap">
        <h2>The ladder</h2>
        <p class="block-lede">Sneat.work's published tiers — Chatwright's Cloud quotas scale with whichever one your account is on. Pricing is flat per account except Company, which is per seat.</p>
        <div class="tier-grid">
          ${tierCardsMarkup}
        </div>
        <article class="lifetime-card">
          <div><span class="lifetime-badge">${lifetimeOffer.badge}</span><h3>${lifetimeOffer.name}</h3><p class="lifetime-price">${lifetimeOffer.price}<span>${lifetimeOffer.priceNote}</span></p><ul class="lifetime-features">${lifetimeFeaturesMarkup}</ul></div>
          <div class="lifetime-cta-col"><a class="button primary" href="${lifetimeOffer.cta.href}">${lifetimeOffer.cta.label}</a></div>
        </article>
        <div class="ladder-foot">
          <p class="contact-line">${contactLine.text} <a href="${contactLine.href}">${contactLine.linkLabel}</a></p>
        </div>
        <p class="credits-line" style="margin-top:1rem;">${aiCreditsLine}</p>
      </div></section>

      <section class="block" id="quotas"><div class="wrap">
        <h2>What counts against Cloud quotas</h2>
        <p class="block-lede">Chatwright's operated Cloud value is what's metered — never the ability to build, run, record or test locally.</p>
        <div class="quota-table-wrap">
          <table class="quota-table">
            <thead><tr><th scope="col">Feature</th><th scope="col">Counts against your quota</th><th scope="col">Always free</th></tr></thead>
            <tbody>
              ${quotaRowsMarkup}
            </tbody>
          </table>
        </div>
        <p class="quota-note">${freeLocalPathSentence}</p>
      </div></section>
    </main>
    ${renderFooter()}
  </body>
</html>`;
