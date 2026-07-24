import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

/** A prototype-nav entry adds the small "static data" hint the real items don't carry. */
interface PrototypeNavigationItem extends NavigationItem {
  hint: string;
}

/** A clearly-marked, non-clickable stub for a spec'd-but-not-yet-built real surface (see studio-ui-surfaces.md's "third door"). */
interface UpcomingNavigationItem {
  label: string;
  icon: string;
  eyebrow: string;
  chip: string;
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

  /**
   * The Studio menu's real section (studio-ui-surfaces.md): only shipped
   * product surfaces. This same list backs both the desktop sidebar's top
   * section and the mobile tab bar — prototypes and the upcoming Composer
   * stay off the mobile bar's limited real estate.
   */
  readonly navigation: NavigationItem[] = [
    {
      label: 'Playground',
      shortLabel: 'Live',
      icon: 'pi pi-bolt',
      route: '/playground',
      eyebrow: 'Chat with a real bot, live'
    },
    {
      label: 'Player',
      shortLabel: 'Play',
      icon: 'pi pi-play-circle',
      route: '/player',
      eyebrow: 'Replay run bundles'
    }
  ];

  /** The third door — spec'd, next to build (studio-ui-surfaces.md's Open Questions). Rendered non-clickable with a "soon" chip until it exists. */
  readonly upcoming: UpcomingNavigationItem = {
    label: 'Composer',
    icon: 'pi pi-pen-to-square',
    eyebrow: 'Perform a scripted take',
    chip: 'soon'
  };

  /** The four mocked pages (static `DemoStore` data) — visible as a design asset, collapsed by default so they don't compete with the real surfaces above. */
  readonly prototypeNavigation: PrototypeNavigationItem[] = [
    {
      label: 'Workspace',
      shortLabel: 'Home',
      icon: 'pi pi-th-large',
      route: '/prototypes/workspace',
      eyebrow: 'Coverage & activity',
      hint: 'static data'
    },
    {
      label: 'Live emulator',
      shortLabel: 'Emulate',
      icon: 'pi pi-comments',
      route: '/prototypes/emulator',
      eyebrow: 'Human-controlled actors',
      hint: 'static data'
    },
    {
      label: 'Scenario',
      shortLabel: 'Specify',
      icon: 'pi pi-sitemap',
      route: '/prototypes/scenario',
      eyebrow: 'Intent & assertions',
      hint: 'static data'
    },
    {
      label: 'Run inspector',
      shortLabel: 'Inspect',
      icon: 'pi pi-wave-pulse',
      route: '/prototypes/run',
      eyebrow: 'Transcript & trace',
      hint: 'static data'
    }
  ];

  /** Collapsed by default — the "Design prototypes" section is a deliberately secondary, opt-in reveal (see studio-ui-surfaces.md's "the Studio gets real"). */
  readonly prototypesExpanded = signal(false);

  constructor(store: DemoStore) {
    this.store = store;
  }

  togglePrototypes(): void {
    this.prototypesExpanded.update((expanded) => !expanded);
  }
}
