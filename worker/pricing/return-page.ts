// The embedded-checkout return page — served at exactly
// https://chatwright.dev/pricing/return (and its trailing-slash variant); see
// ../index.ts. Stripe's embedded checkout on /pricing (./page.ts) sends the
// buyer here with a ?session_id=cs_... query; client JS asks the central
// checkout service (./checkout-config.ts) for the session's status and shows
// exactly one of four states: checking (initial), complete (success panel),
// open (payment still processing) or error/expired (friendly retry back to
// /pricing). The HTML itself is static and session-agnostic — everything
// session-specific arrives via the query string and the status fetch. Follows
// the same inline-HTML doc-page pattern as ./page.ts: shared chrome from
// ../chrome.ts, a single exported String.raw document.
import { checkoutBase } from './checkout-config';
import { renderHeader, renderFooter, chromeStyles, themeInitScript } from '../chrome';

// Same conventions as the checkout script in ./page.ts: IIFE, var, no
// template literals, `checkoutBase` baked in as a const. Any non-200,
// network error, missing session_id or unknown status lands on the error
// state — which never dead-ends, it links back to /pricing.
const returnStatusScript = `<script>(function(){
  var CHECKOUT_BASE = '${checkoutBase}';
  var PLAN_LABELS = { pro: 'Pro', team: 'Team', company: 'Company' };
  var states = ['return-checking', 'return-complete', 'return-open', 'return-error'];

  function show(id) {
    for (var i = 0; i < states.length; i++) {
      var element = document.getElementById(states[i]);
      if (element) { element.hidden = states[i] !== id; }
    }
  }

  var sessionId = null;
  // The service bakes &mode=test|live into Stripe's return URL so this
  // page can query the session in the same Stripe mode it was created in.
  var mode = null;
  try {
    var params = new URLSearchParams(location.search);
    sessionId = params.get('session_id');
    var modeParam = params.get('mode');
    if (modeParam === 'test' || modeParam === 'live') { mode = modeParam; }
  } catch (e) {}
  if (!sessionId) {
    show('return-error');
    return;
  }

  var refreshButton = document.getElementById('return-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', function () { location.reload(); });
  }

  fetch(CHECKOUT_BASE + '/session-status?site=chatwright&session_id=' + encodeURIComponent(sessionId) + (mode ? '&mode=' + mode : ''))
    .then(function (response) {
      if (!response.ok) { throw new Error('session-status failed'); }
      return response.json();
    })
    .then(function (status) {
      if (status.status === 'complete') {
        var plan = document.getElementById('return-plan');
        if (plan) { plan.textContent = PLAN_LABELS[status.plan] || status.plan || 'your new plan'; }
        var email = document.getElementById('return-email');
        if (email && status.customerEmail) { email.textContent = status.customerEmail; }
        // Stripe only emails receipts for LIVE payments (and only when
        // receipt emails are enabled) — never in test mode. Say so instead
        // of promising mail that will not arrive.
        var receiptNote = document.getElementById('return-receipt-note');
        if (receiptNote) {
          receiptNote.textContent = mode === 'test' ? ' (test mode — Stripe sends no email receipts)' : ' — Stripe emails your receipt there';
        }
        show('return-complete');
      } else if (status.status === 'open') {
        show('return-open');
      } else {
        show('return-error');
      }
    })
    .catch(function () {
      show('return-error');
    });
})();</script>`;

export const pricingReturnPageDocument = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    ${themeInitScript}
    <meta name="robots" content="noindex">
    <title>Checkout — Chatwright</title>
    <link rel="canonical" href="https://chatwright.dev/pricing/return">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23111827'/%3E%3Crect x='14' y='16' width='36' height='24' rx='7' fill='%230f766e'/%3E%3Cpath d='M22 40 L22 48 L30 40 Z' fill='%230f766e'/%3E%3C/svg%3E">
    <style>
      :root { color-scheme: light; --ink:#111827; --soft:#566477; --faint:#8290a4; --line:#e5eaf0; --canvas:#fcfcfd; --card:#ffffff; --card-soft:#f7f9fb; --blue:#2c6dcc; --code-bg:#eef2f6; --code-ink:#1a2740; --accent:#0f766e; --accent-hover:#115e59; --accent-ink:#0d9488; --accent-tint-bg:#f0fdfa; --accent-tint-border:#99f6e4; --accent-tint-ink:#115e59; --nav-bg:rgba(252,252,253,.9); --nav-border:rgba(229,234,240,.9); --nav-hover-bg:#f2f5f8; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); } a { color:inherit; }
      .wrap { width:min(1180px,calc(100% - 3rem)); margin-inline:auto; }
      ${chromeStyles}
      .button { min-height:2.7rem; display:inline-flex; align-items:center; justify-content:center; padding:0 .95rem; border:1px solid transparent; border-radius:.55rem; font:680 .84rem/1 inherit; text-decoration:none; transition:transform .18s ease,box-shadow .18s ease; } .button:hover { transform:translateY(-1px); }
      .primary { color:#fff; background:var(--accent); box-shadow:0 8px 20px rgba(15,118,110,.17); } .primary:hover { background:var(--accent-hover); } .quiet { border-color:var(--line); background:var(--card); color:var(--ink); }
      button.button { appearance:none; -webkit-appearance:none; cursor:pointer; }
      [hidden] { display:none !important; }
      .doc { max-width:46rem; padding:clamp(2.75rem,6vw,4.5rem) 0 clamp(2.5rem,6vw,4rem); }
      .eyebrow { margin:0 0 .85rem; color:var(--blue); font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(1.9rem,3.4vw,2.6rem); line-height:1.12; letter-spacing:-.045em; }
      .lede { max-width:44rem; margin:1.1rem 0 0; color:var(--soft); font-size:1.05rem; line-height:1.65; }
      .return-state { margin-top:1.6rem; padding:1.75rem 1.9rem 2rem; border:1px solid var(--line); border-radius:1rem; background:var(--card); }
      .return-state.good { border-color:var(--accent-tint-border); background:var(--accent-tint-bg); }
      .return-state.good h1, .return-state.good .lede { color:var(--accent-tint-ink); }
      .return-state.good .lede strong { color:inherit; }
      .return-checking-line { margin:0; color:var(--soft); font-size:.95rem; }
      .return-actions { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:1.4rem; }
      #return-plan { color:var(--accent-ink); }
    </style>
  </head>
  <body>
    ${renderHeader('pricing')}
    <main>
      <div class="wrap doc" id="checkout-return">
        <p class="eyebrow">Checkout</p>

        <div class="return-state" id="return-checking">
          <p class="return-checking-line">Checking your payment…</p>
        </div>

        <div class="return-state good" id="return-complete" hidden>
          <h1>You're on <span id="return-plan">your new plan</span>.</h1>
          <p class="lede">Paid by <strong id="return-email">your email</strong><span id="return-receipt-note"></span>. Cloud activation lands on your account shortly — everything local keeps working meanwhile.</p>
          <div class="return-actions">
            <a class="button primary" href="/studio/">Open Studio</a>
            <a class="button quiet" href="/billing">Go to billing</a>
          </div>
        </div>

        <div class="return-state" id="return-open" hidden>
          <h1>Payment still processing</h1>
          <p class="lede">Payment still processing — refresh in a moment.</p>
          <div class="return-actions">
            <button type="button" class="button primary" id="return-refresh">Refresh now</button>
            <a class="button quiet" href="/pricing">Back to pricing</a>
          </div>
        </div>

        <div class="return-state" id="return-error" hidden>
          <h1>We couldn't confirm this payment.</h1>
          <p class="lede">The checkout session may have expired before completing. If you did finish paying, your receipt email is on its way — otherwise, no harm done: pick your plan again on the pricing page.</p>
          <div class="return-actions">
            <a class="button primary" href="/pricing">Back to pricing</a>
            <a class="button quiet" href="/studio/">Open Studio</a>
          </div>
        </div>
      </div>
    </main>
    ${renderFooter()}
    ${returnStatusScript}
  </body>
</html>`;
