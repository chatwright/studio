import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { DemoStore } from './demo.store';
import { parseEmbedParams } from './player/embed-params';

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

  /**
   * `?embed=1` (landing-hero player embed, see player/embed-params.ts) hides
   * this entire shell — sidebar, topbar, mobile nav — so an embedding iframe
   * gets a chromeless, transcript-first surface. Query params are shared
   * across the whole route tree, so the root ActivatedRoute sees them
   * regardless of which child route (currently only /player) is active.
   */
  private readonly route = inject(ActivatedRoute);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });
  readonly embed = computed(() => parseEmbedParams(this.queryParamMap()).embed);

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
    },
    {
      label: 'Player',
      shortLabel: 'Play',
      icon: 'pi pi-play-circle',
      route: '/player',
      eyebrow: 'Replay run bundles'
    },
    {
      label: 'Playground',
      shortLabel: 'Live',
      icon: 'pi pi-bolt',
      route: '/playground',
      eyebrow: 'Chat with a real bot, live'
    }
  ];

  constructor(store: DemoStore) {
    this.store = store;
  }
}
