// The /billing page — today an honest holding page, soon the launcher for
// Stripe's hosted Customer Portal (plan changes, cancellation, payment
// methods, invoices) once the auth-gated portal-session endpoint lands in
// the checkout service (paymentus subscriptions; needs the signed-in
// identity that arrived with the Studio's Sneat sign-in). Linked from the
// checkout return page's "Go to billing". Follows the same inline-HTML
// doc-page pattern as ./pricing/page.ts: shared chrome, a single exported
// String.raw document.
import { renderHeader, renderFooter, chromeStyles, themeInitScript } from '../chrome';

export const billingPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <title>Billing — Chatwright</title>
    <meta name="robots" content="noindex">
    <style>
      :root { --ink:#111827; --soft:#3f4c5e; --faint:#4e5c70; --line:#e5eaf0; --canvas:#fcfcfd; --card:#ffffff; --card-soft:#f6f8fa; --blue:#2c6dcc; --code-bg:#eef3f8; --code-ink:#20304a; --accent:#0f766e; --accent-hover:#115e59; --accent-ink:#0d9488; --accent-tint-border:#bce9d8; --accent-tint-ink:#0f766e; --accent-tint-bg:#effbf5; --nav-bg:rgba(252,252,253,.9); --nav-border:rgba(229,234,240,.9); --nav-hover-bg:#f2f5f8; }
      * { box-sizing:border-box; margin:0; }
      html { color-scheme:light dark; }
      body { background:var(--canvas); color:var(--ink); font:400 1rem/1.6 system-ui,-apple-system,'Segoe UI',sans-serif; -webkit-font-smoothing:antialiased; }
      a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      ${chromeStyles}
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#fff; background:var(--accent); } .primary:hover { background:var(--accent-hover); }
      .quiet { border-color:var(--line); background:var(--card); color:var(--ink); }
      .doc { max-width:44rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(3rem,7vw,5rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0 0 .9rem; font-size:clamp(2rem,3.4vw,2.7rem); line-height:1.1; letter-spacing:-.04em; }
      .lede { color:var(--soft); font-size:1.05rem; }
      .card { margin-top:1.6rem; padding:1.4rem 1.5rem; border:1px solid var(--accent-tint-border); border-radius:.75rem; background:var(--accent-tint-bg); color:var(--accent-tint-ink); }
      .card p { margin:0; line-height:1.6; } .card p + p { margin-top:.6rem; }
      .card a { color:var(--accent-ink); font-weight:650; }
      .actions { display:flex; flex-wrap:wrap; gap:.7rem; margin-top:1.6rem; }
    </style>
  </head>
  <body id="billing-page">
    ${renderHeader(null)}
    <main class="wrap doc">
      <p class="eyebrow">Billing</p>
      <h1>Self-serve billing is on its way.</h1>
      <p class="lede">Plan changes, cancellation, payment methods and invoices will be managed right here through Stripe's secure customer portal, tied to your Sneat sign-in.</p>
      <div class="card">
        <p><strong>Need a change today?</strong> Email <a href="mailto:hello@sneat.co?subject=Billing">hello@sneat.co</a> with what you need — plan switch, cancellation, invoice copy — and it's handled the same day.</p>
        <p>Nothing local ever depends on billing: the complete CLI, runtime and Studio stay free and account-free, always.</p>
      </div>
      <div class="actions">
        <a class="button primary" href="/pricing">See plans</a>
        <a class="button quiet" href="/studio/">Open Studio</a>
      </div>
    </main>
    ${renderFooter()}
  </body>
</html>`;
