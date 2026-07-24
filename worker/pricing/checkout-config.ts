// Base URL of the central Sneat checkout service — one shared Stripe-checkout
// Worker serving every Sneat-ecosystem site; chatwright.dev is one allowlisted
// `site` (CORS for chatwright.dev and localhost:8787 is handled service-side).
// The service is deployed and live at this URL; while its Stripe keys aren't
// configured yet, GET {base}/config responds 503 {"code":"not_configured"} and
// the pricing page shows its on-site fallback panel instead of the embedded
// Stripe checkout — the page degrades, never breaks.
//
// Every piece of client JS reads this from one place: the pricing and
// checkout-return pages inline it into their rendered documents as a const.
export const checkoutBase = 'https://sneat-checkout.alexander-trakhimenok.workers.dev';
