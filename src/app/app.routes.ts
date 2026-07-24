import { Routes } from '@angular/router';

/**
 * Route map (spec/ideas/studio-ui-surfaces.md, MVP Scope item 2 — "the
 * Studio gets real: /prototypes/"):
 *
 *  - The four mocked, static-demo-data pages (workspace, emulator,
 *    scenario, run — all driven by `DemoStore`) live under the
 *    `prototypes/` prefix. They are a design asset, not the product.
 *  - `/player` and `/playground` are the real product surfaces and keep
 *    their top-level paths.
 *  - The old top-level paths for the four prototype pages redirect to
 *    their new `prototypes/` location. A plain string `redirectTo`
 *    preserves query params and the fragment, so deep links like
 *    `/run?event=2&platform=telegram&view=rendered` keep working.
 *  - The root path and the wildcard both land on Playground — the real
 *    front door — not a prototype.
 */
export const routes: Routes = [
  {
    path: 'prototypes',
    children: [
      {
        path: 'workspace',
        loadComponent: () =>
          import('./pages/workspace/workspace.page').then((module) => module.WorkspacePage)
      },
      {
        path: 'emulator',
        loadComponent: () =>
          import('./pages/emulator/emulator.page').then((module) => module.EmulatorPage)
      },
      {
        path: 'scenario',
        loadComponent: () =>
          import('./pages/scenario/scenario.page').then((module) => module.ScenarioPage)
      },
      {
        path: 'run',
        loadComponent: () =>
          import('./pages/run/run.page').then((module) => module.RunPage)
      }
    ]
  },
  // Legacy top-level URLs for the four prototype pages — redirect to the
  // prototypes/ prefix above.
  { path: 'workspace', pathMatch: 'full', redirectTo: 'prototypes/workspace' },
  { path: 'emulator', pathMatch: 'full', redirectTo: 'prototypes/emulator' },
  { path: 'scenario', pathMatch: 'full', redirectTo: 'prototypes/scenario' },
  { path: 'run', pathMatch: 'full', redirectTo: 'prototypes/run' },
  {
    path: 'player',
    loadComponent: () =>
      import('./pages/player/player.page').then((module) => module.PlayerPage)
  },
  {
    path: 'recordings',
    loadComponent: () =>
      import('./pages/recordings/recordings.page').then((module) => module.RecordingsPage)
  },
  {
    path: 'playground',
    loadComponent: () =>
      import('./pages/playground/playground.page').then((module) => module.PlaygroundPage)
  },
  { path: '', pathMatch: 'full', redirectTo: 'playground' },
  { path: '**', redirectTo: 'playground' }
];
