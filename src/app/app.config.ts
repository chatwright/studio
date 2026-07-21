import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { primeUILicense } from './primeui-license.local';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({
      license: primeUILicense,
      ripple: true,
      theme: {
        preset: Aura,
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
