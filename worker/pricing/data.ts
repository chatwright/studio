// Hand-embedded pricing data for the /pricing page (see ./page.ts and
// ../index.ts). This is NOT generated: numbers and wording were read
// directly out of two sources and copied in by hand —
//
//   1. /sneat-astro/src/data/pricing.ts — the `sneatWorkPricing` dataset
//      (the canonical `PricingTier[]` shape and numbers: SETTLED ladder v2,
//      founder decision 2026-07-24, first published on sneat.team-website).
//      Chatwright is a thin, bundle-explaining consumer of that same
//      dataset's numbers — not a fork with its own prices.
//   2. chatwright/backstage/strategy/pricing.md — "SETTLED ladder v2" and
//      the boundary rules ("Limits apply ONLY to operated Cloud value.
//      Download-to-disk is always free and unlimited; BYOK AI-testing is
//      unlimited on every plan." / "Every limit message offers the free
//      local path in the same breath — the gate sells, never traps.").
//
// There is no build step, CI job or fetch that keeps this file in sync with
// either source — it silently drifts whenever sneat.work pricing or the
// Chatwright quota design changes; a human has to notice and re-sync it,
// same disclaimer as worker/recipes/data.ts.

export type PricingUnit = 'account' | 'seat';

/**
 * Plans purchasable on-site through the central checkout service — the ids
 * are the service's own plan ids (POST {base}/session accepts exactly these).
 */
export type BuyablePlanId = 'pro' | 'team' | 'company';

/** A CTA that navigates somewhere — an internal path, external URL or mailto. */
export interface PricingCtaLink {
  readonly kind: 'link';
  readonly label: string;
  readonly href: string;
}

/**
 * A CTA that opens the embedded Stripe checkout right on /pricing (see
 * ./page.ts and ./checkout-config.ts) — no pricing-page-to-pricing-page
 * bounce; checkout happens on chatwright.dev.
 */
export interface PricingCtaBuy {
  readonly kind: 'buy';
  readonly plan: BuyablePlanId;
  readonly label: string;
}

export type PricingTierCta = PricingCtaLink | PricingCtaBuy;

/** One subscription-pricing card — mirrors @sneat/astro's PricingTier shape. */
export interface PricingTier {
  readonly id: string;
  readonly name: string;
  /** Headline price as already-formatted display text, e.g. "$9/mo". */
  readonly price: string;
  /** Small text under the price, e.g. "flat · per account, not per seat". */
  readonly priceNote: string;
  /** Flat per-account billing vs metered per-seat billing (explicit per card). */
  readonly unit: PricingUnit;
  readonly features: readonly string[];
  readonly cta: PricingTierCta;
  /** Visually highlight this card. */
  readonly featured?: boolean;
}

// What you buy is still the sneat.work subscription (the bundle framing is
// unchanged), but the buying itself happens right here: paid tiers carry a
// `buy` CTA that opens Stripe's embedded checkout on this page. Only the
// Lifetime launch offer below still links out — for now.
export const pricingTiers: readonly PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: 'free forever · per account',
    unit: 'account',
    features: [
      '1 team, up to 5 members',
      'Starter Cloud usage: saved recordings, composed recordings, hosted AI-testing turns',
      'The whole Sneat.work suite included — not just Chatwright'
    ],
    cta: { kind: 'link', label: 'Start free — Open Studio', href: '/studio/' }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9/mo',
    priceNote: 'per account',
    unit: 'account',
    features: [
      'Everything in Free, with much higher usage',
      'More saved recordings, composed recordings & hosted AI-testing turns',
      "For individuals and small crews who outgrow Free's limits"
    ],
    cta: { kind: 'buy', plan: 'pro', label: 'Start Pro — $9/mo' }
  },
  {
    id: 'team',
    name: 'Team',
    price: '$29/mo',
    priceNote: 'flat · per account, not per seat',
    unit: 'account',
    features: [
      '1 team, up to 10 members',
      'Whole-team price — invite everyone, no per-seat math',
      'Higher Cloud quotas across saved recordings, composed recordings and AI-testing turns'
    ],
    cta: { kind: 'buy', plan: 'team', label: 'Start Team — $29/mo' }
  },
  {
    id: 'company',
    name: 'Company',
    price: '$9/seat/mo',
    priceNote: 'per seat, per month',
    unit: 'seat',
    features: ['Multiple flat teams, each with its own silo', 'Up to 100 users', 'Everything in Team, for every team'],
    cta: { kind: 'buy', plan: 'company', label: 'Start Company — $9/seat' }
  }
];

export interface LifetimeOffer {
  readonly name: string;
  readonly badge: string;
  readonly price: string;
  readonly priceNote: string;
  readonly features: readonly string[];
  /**
   * Deliberately still a link (not a `buy` CTA): one-time lifetime purchases
   * aren't in the checkout service's subscription plan set yet, so this card
   * keeps its sneat.work link until they are.
   */
  readonly cta: PricingCtaLink;
}

export const lifetimeOffer: LifetimeOffer = {
  name: 'Team Lifetime',
  badge: 'Launch offer — first 100 teams',
  price: '$299',
  priceNote: 'one-time · then $499',
  features: [
    "Deducts the Team subscription's cost from whatever plan you're on — forever",
    'One payment, no subscription',
    '90-day money-back guarantee — full refund, no questions'
  ],
  cta: { kind: 'link', label: 'Get it with sneat.work →', href: 'https://sneat.work/team/#pricing' }
};

export interface ContactLine {
  readonly text: string;
  readonly linkLabel: string;
  readonly href: string;
}

/** The quiet "too big for these tiers?" line under the grid. */
export const contactLine: ContactLine = {
  text: 'Larger organization? Hierarchical teams and enterprise controls —',
  linkLabel: 'talk to us',
  href: 'mailto:hello@sneat.co?subject=Sneat.work%20%E2%80%94%20Business%2FEnterprise%20plan'
};

export const aiCreditsLine =
  "Hosted AI-testing turns (our keys, server-side) come with every tier above. Need more? Extra AI credits will be purchasable soon — bring-your-own-key AI-testing stays unlimited on every plan in the meantime.";

/** The complete local stack — free forever, on every plan, including no plan at all. */
export const freeForeverItems: readonly string[] = [
  'CLI',
  'Runtime',
  'Studio',
  'Playground',
  'Player',
  'Composer (soon)',
  'BYOK AI-testing — bring your own key',
  'Download recordings to disk'
];

export interface QuotaRow {
  readonly feature: string;
  readonly counts: string;
  readonly alwaysFree: string;
}

/** What counts against a Cloud quota, and what stays free no matter what. */
export const quotaRows: readonly QuotaRow[] = [
  {
    feature: 'Saved recordings',
    counts: 'Recordings kept in Chatwright Cloud — synced, shareable, searchable',
    alwaysFree: 'Downloading that same recording to disk, any time'
  },
  {
    feature: 'Composed recordings',
    counts: 'Recordings built with Composer (coming) and saved to Cloud',
    alwaysFree: 'Composing locally and downloading to disk'
  },
  {
    feature: 'Team members',
    counts: 'Seats sharing a Cloud team space',
    alwaysFree: 'Local Studio use by anyone — no seat needed'
  },
  {
    feature: 'Hosted AI-testing turns',
    counts: "AI-actor conversation turns run on Chatwright's own keys",
    alwaysFree: 'BYOK AI-testing — bring your own key, unlimited, every plan'
  }
];

export const freeLocalPathSentence =
  'Hitting a limit never blocks downloading your work to disk — that path stays free and unlimited, on every plan, including no plan at all.';
