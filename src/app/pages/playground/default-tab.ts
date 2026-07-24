/**
 * Pure logic for the Playground's default-tab rule (founder tweak #8):
 * Compare on wide viewports, Telegram on narrow ones — overridden either
 * way by an explicit `?tab=` query param, which `playground.page.ts` also
 * writes back on every tab switch (`router.navigate(..., { replaceUrl:
 * true })`, which is Angular's own wrapper around `history.replaceState` —
 * see run.page.ts's `selectTrace`/`selectDetailTab` for the same idiom
 * already established elsewhere in this app) so a shared/bookmarked link
 * reproduces exactly the tab the visitor was looking at.
 *
 * Kept framework-free (no `ActivatedRoute`, no `matchMedia` call in here)
 * so it's cheaply unit-testable without Angular's TestBed — the page reads
 * the query param and viewport itself and passes both in.
 */

/**
 * `'ai-test'` (the AI-goal test-runner tab, see `ai-test/ai-test-panel.component.ts`)
 * is reachable only via an explicit `?tab=ai-test` or a direct click — it is
 * deliberately never one of `resolveInitialTab`'s own viewport-based
 * defaults below, same as `'whatsapp'` never is either; only `'compare'`
 * and `'telegram'` are auto-selected.
 */
export type PlaygroundTab = 'telegram' | 'whatsapp' | 'compare' | 'ai-test';

const VALID_TABS: readonly PlaygroundTab[] = ['telegram', 'whatsapp', 'compare', 'ai-test'];

export function isPlaygroundTab(value: string | null | undefined): value is PlaygroundTab {
  return (VALID_TABS as readonly string[]).includes(value ?? '');
}

/**
 * `queryParamTab` — the raw `?tab=` value (or `null`/`undefined` if absent
 * or invalid); `isWideViewport` — the page's own `matchMedia('(min-width:
 * 1024px)').matches` at init.
 */
export function resolveInitialTab(queryParamTab: string | null | undefined, isWideViewport: boolean): PlaygroundTab {
  if (isPlaygroundTab(queryParamTab)) {
    return queryParamTab;
  }
  return isWideViewport ? 'compare' : 'telegram';
}
