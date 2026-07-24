/**
 * Pure logic for the "internals open by default" rule (founder tweak): a
 * single-platform tab's own bot-internals panel opens by default on a
 * ≥1280px viewport — room enough for chat + internals side by side. Compare
 * mode's ONE shared internals panel (see playground.page.ts's
 * `compareShowInternals` / chat-pane.component.ts's `showBotInternals`) is
 * always closed by default instead, regardless of viewport: two panes
 * already crowd a wide screen, and a visitor opts in explicitly via the
 * single "Show bot internals" control in the compare header. Either way the
 * user's own toggle click always wins from then on — this only decides the
 * value at mount.
 *
 * Kept framework-free (no `matchMedia` call in here) so it's cheaply
 * unit-testable without a DOM — same idiom as `resolveInitialTab` in
 * default-tab.ts: the caller reads its own viewport and passes it in.
 */

export type InternalsScope = 'single-tab' | 'compare';

export function resolveInitialShowBotInternals(scope: InternalsScope, isWideViewport: boolean): boolean {
  if (scope === 'compare') {
    return false;
  }
  return isWideViewport;
}
