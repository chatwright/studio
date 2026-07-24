// Shared header and footer for every worker-rendered chatwright.dev page —
// worker/landing.ts, worker/pricing/page.ts, worker/recipes/page.ts,
// worker/formats/*/v1/page.ts and worker/try-github.ts. One nav, one footer,
// one CSS block: dedupe the bespoke per-page copies these pages used to
// carry so a nav change lands once instead of six times. The Angular app
// under /studio/ is out of scope — it renders its own chrome.
//
// Usage: each page imports `chromeStyles` into its own <style> block (in
// addition to that page's own styles — chromeStyles only covers the header/
// footer/nav rules, not the general `.wrap`/`.button`/`:root` primitives
// every page already declares for its own body content), then calls
// `renderHeader(current)` and `renderFooter(extraFooterHtml?)` in its markup.

export type ChromeCurrentPage = 'home' | 'player' | 'playground' | 'recipes' | 'pricing' | null;

interface ChromeNavLink {
  readonly key: 'player' | 'playground' | 'recipes' | 'pricing';
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

// One nav for every page — Player, Playground, Recipes, Pricing, GitHub. The
// current page's own item is never omitted (a founder call: omitting it is
// more confusing than showing it highlighted), it's just visually marked.
const navLinks: readonly ChromeNavLink[] = [
  { key: 'player', label: 'Player', href: '/studio/player', icon: '▶' },
  { key: 'playground', label: 'Playground', href: '/studio/playground', icon: '⚡' },
  { key: 'recipes', label: 'Recipes', href: '/recipes', icon: '🍳' },
  { key: 'pricing', label: 'Pricing', href: '/pricing', icon: '🏷️' }
];

const githubHref = 'https://github.com/chatwright/chatwright';
const githubIconSvg =
  '<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path></svg>';

function renderFullNavLink(link: ChromeNavLink, current: ChromeCurrentPage): string {
  const isCurrent = current === link.key;
  const attrs = isCurrent ? ' class="current" aria-current="page"' : '';
  return `<a href="${link.href}"${attrs}>${link.label}</a>`;
}

function renderCompactNavLink(link: ChromeNavLink, current: ChromeCurrentPage): string {
  const isCurrent = current === link.key;
  const linkClass = isCurrent ? 'icon-link current' : 'icon-link';
  const currentAttr = isCurrent ? ' aria-current="page"' : '';
  return `<a class="${linkClass}" href="${link.href}" aria-label="${link.label}" title="${link.label}"${currentAttr}><span class="icon-emoji" aria-hidden="true">${link.icon}</span><span class="visually-hidden">${link.label}</span></a>`;
}

/**
 * Renders the shared `<header class="nav">` for every worker-rendered page.
 *
 * `current` marks which nav item is "this page" — bold + underline in the
 * full nav, an accent dot under its icon in the ≤720px compact nav, and
 * `aria-current="page"` on both. It is never omitted from the nav, only
 * highlighted. `null` (used by the landing page, and every doc/utility page
 * with no corresponding nav item — the brand block is the "home" link, there
 * is no separate "Home" nav item) and `'home'` both render the nav with
 * nothing marked current.
 *
 * The CTA is responsive by CSS alone (see `chromeStyles`): "Open Studio" at
 * ≥1024px, "Studio" at 721–1023px, and — at ≤720px — the CTA text button
 * disappears in favour of the 🎛️ accent icon button already living in the
 * compact icon row alongside the other icons.
 */
export function renderHeader(current: ChromeCurrentPage): string {
  const fullLinksMarkup = navLinks.map((link) => renderFullNavLink(link, current)).join('') + `<a href="${githubHref}">GitHub</a>`;
  const compactLinksMarkup = navLinks.map((link) => renderCompactNavLink(link, current)).join('');

  return (
    `<header class="nav"><div class="wrap">` +
    `<a class="brand" href="/" aria-label="Chatwright home">Chatwright <small>by sneat.dev</small></a>` +
    `<nav class="links" aria-label="Primary navigation">${fullLinksMarkup}</nav>` +
    `<nav class="links-compact" aria-label="Primary navigation">${compactLinksMarkup}` +
    `<a class="icon-link icon-svg" href="${githubHref}" aria-label="GitHub" title="GitHub"><span aria-hidden="true">${githubIconSvg}</span><span class="visually-hidden">GitHub</span></a>` +
    `<a class="icon-link icon-cta" href="/studio/" aria-label="Open Studio" title="Open Studio"><span class="icon-emoji" aria-hidden="true">🎛️</span><span class="visually-hidden">Open Studio</span></a>` +
    `</nav>` +
    `<a class="button primary" href="/studio/"><span class="cta-label-full">Open Studio</span><span class="cta-label-short">Studio</span></a>` +
    `</div></header>`
  );
}

/**
 * Renders the shared `<footer>` for every worker-rendered page — the
 * landing page's footer links (Pricing, chatwright/recipes,
 * chatwright/runtime-ts, SpecScore, sneat.dev). Pages that need extra
 * footer content of their own (e.g. /recipes' provenance note) pass it as
 * `extraFooterHtml`; it renders in its own row beneath the shared block
 * rather than being spliced into it, so the shared block itself stays
 * identical byte-for-byte across every page.
 */
export function renderFooter(extraFooterHtml?: string): string {
  const extraMarkup = extraFooterHtml ? `<div class="wrap foot-extra">${extraFooterHtml}</div>` : '';
  return (
    `<footer><div class="wrap">` +
    `<span>An independent open-source project by Sneat.co</span>` +
    `<nav class="foot-links" aria-label="Footer">` +
    `<a href="/pricing">Pricing</a>` +
    `<a href="https://github.com/chatwright/recipes">chatwright/recipes</a>` +
    `<a href="https://github.com/chatwright/runtime-ts">chatwright/runtime-ts</a>` +
    `<a href="https://specscore.md/">Developed spec-first with SpecScore</a>` +
    `<a href="https://sneat.dev/">Explore sneat.dev →</a>` +
    `</nav>` +
    `</div>${extraMarkup}</footer>`
  );
}

/**
 * Shared header/footer/nav CSS, meant to be interpolated into every page's
 * own `<style>` block alongside that page's own rules (its `:root`
 * variables, `.wrap`, `.button`/`.primary`/`.quiet`, and body content
 * styles stay page-local — they're used well beyond the header and footer,
 * so duplicating a handful of shared primitives per page is the right
 * trade-off against pulling a whole design system through this module).
 */
export const chromeStyles = `
      .nav { position:sticky; z-index:10; top:0; border-bottom:1px solid rgba(229,234,240,.9); background:rgba(252,252,253,.9); backdrop-filter:blur(16px); }
      .nav > .wrap { min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:1.2rem; }
      .brand { color:var(--ink); font-size:1.1rem; font-weight:730; letter-spacing:-.05em; text-decoration:none; } .brand small { margin-left:.45rem; color:var(--soft); font-size:.65rem; font-weight:650; letter-spacing:.02em; }
      .links { display:flex; align-items:center; gap:1.35rem; color:#4e5c70; font-size:.85rem; } .links a { text-decoration:none; } .links a:hover { color:var(--ink); }
      .links a.current { color:var(--ink); font-weight:800; text-decoration:underline; text-decoration-thickness:2px; text-underline-offset:.28em; }
      .links-compact { display:none; align-items:center; gap:.2rem; color:#4e5c70; }
      .icon-link { position:relative; display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:.55rem; color:#4e5c70; text-decoration:none; } .icon-link:hover { color:var(--ink); background:#f2f5f8; } .icon-emoji { font-size:1.05rem; line-height:1; } .icon-svg svg { display:block; width:18px; height:18px; }
      .icon-link.current { color:var(--ink); }
      .icon-link.current::after { content:""; position:absolute; left:50%; bottom:.3rem; width:.3rem; height:.3rem; border-radius:50%; background:var(--mint-ink); transform:translateX(-50%); }
      .icon-cta { margin-left:.15rem; color:#06271d; background:var(--mint); box-shadow:0 4px 10px rgba(80,203,160,.24); } .icon-cta:hover { color:#06271d; background:var(--mint); filter:brightness(1.05); }
      .icon-cta.current::after { display:none; }
      .visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      .cta-label-short { display:none; }
      @media (max-width:1023px) { .cta-label-full { display:none; } .cta-label-short { display:inline; } }
      footer { padding:2.5rem 0 3rem; color:#718094; font-size:.78rem; } footer .wrap { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; border-top:1px solid var(--line); padding-top:1.45rem; } footer a { color:var(--soft); text-decoration:none; }
      .foot-links { display:flex; flex-wrap:wrap; align-items:center; gap:.55rem 1.1rem; }
      footer .foot-extra { margin-top:0; padding-top:.85rem; border-top:none; color:#8290a4; font-size:.76rem; }
      @media (max-width:720px) { .nav > .wrap { min-height:64px; } .links { display:none; } .links-compact { display:flex; } .nav > .wrap > .button.primary { display:none; } .brand small { display:none; } footer .wrap { align-items:flex-start; flex-direction:column; } }
`;
