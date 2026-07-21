import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { DemoStore } from './demo.store';

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: string;
  route: string;
  eyebrow: string;
}

@Component({
  selector: 'cw-root',
  imports: [
    AvatarModule,
    ButtonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TagModule,
    TooltipModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly store: DemoStore;

  readonly navigation: NavigationItem[] = [
    {
      label: 'Workspace',
      shortLabel: 'Home',
      icon: 'pi pi-th-large',
      route: '/workspace',
      eyebrow: 'Coverage & activity'
    },
    {
      label: 'Live emulator',
      shortLabel: 'Emulate',
      icon: 'pi pi-comments',
      route: '/emulator',
      eyebrow: 'Human-controlled actors'
    },
    {
      label: 'Scenario',
      shortLabel: 'Specify',
      icon: 'pi pi-sitemap',
      route: '/scenario',
      eyebrow: 'Intent & assertions'
    },
    {
      label: 'Run inspector',
      shortLabel: 'Inspect',
      icon: 'pi pi-wave-pulse',
      route: '/run',
      eyebrow: 'Transcript & trace'
    }
  ];

  constructor(store: DemoStore) {
    this.store = store;
  }
}
