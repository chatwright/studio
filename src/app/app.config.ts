import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { primeUILicense } from './primeui-license.local';

/**
 * Aura's own default `primary` semantic palette is emerald green — bare
 * `preset: Aura` (before this change) meant every PrimeNG component reading
 * PrimeNG's own `primary` design tokens (a default-severity `<p-button>`
 * with no `severity` input, like the Playground's "Download" button and the
 * Player transport bar's play/pause button, plus default focus rings and
 * checked-state controls) rendered GREEN — entirely independent of this
 * app's own `--cw-mint`/`--cw-green` custom properties, and invisible to a
 * sweep of this file's own SCSS. The founder's brand-accent FINAL decision
 * (2026-07-24, mint/green -> teal, backstage/strategy/brand-accent-session.md)
 * requires PrimeNG's OWN primary palette to move too, or "brand accent
 * everywhere" silently excludes every default-severity PrimeNG control.
 * Full Tailwind teal scale — #0f766e (700) is where the FINAL decision's
 * solid-accent hex lands, keeping this preset's shade math boringly
 * standard rather than hand-picking a one-off ramp.
 */
const ChatwrightPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2c'
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({
      license: primeUILicense,
      ripple: true,
      theme: {
        preset: ChatwrightPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'app-reset, primeng, app'
          }
        }
      }
    })
  ]
};
