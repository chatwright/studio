import { Routes } from '@angular/router';

export const routes: Routes = [
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
  },
  { path: '', pathMatch: 'full', redirectTo: 'emulator' },
  { path: '**', redirectTo: 'workspace' }
];
