// Base URL of the central Sneat checkout service — the paymentus
// subscriptions backend (github.com/sneat-co/paymentus backend/subscriptions),
// wired into sneat-go and served on api.sneat.cloud under /v0/checkout
// (founder decision 2026-07-24: payments consolidate into the Go backend; the
// interim sneat-checkout CF worker is retired). chatwright.dev is one
// allowlisted `site` — CORS for chatwright.dev and localhost:8787 is handled
// service-side, and test/live Stripe modes coexist per request (the page's
// ?checkout=test override).
//
// While a mode's Stripe keys aren't configured yet, GET {base}/config answers
// 503 {"code":"not_configured"} and the pricing page shows its on-site
// fallback panel instead of the embedded checkout — the page degrades, never
// breaks.
//
// Every piece of client JS reads this from one place: the pricing and
// checkout-return pages inline it into their rendered documents as a const.
export const checkoutBase = 'https://api.sneat.cloud/v0/checkout';
