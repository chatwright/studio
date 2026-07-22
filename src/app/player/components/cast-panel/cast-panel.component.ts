import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { BundleActor } from '../../model/bundle.types';
import { PlayerEngine } from '../../player-engine';

/** The cast: the run's actors roster with type badges, platform identities and
 *  (for AI actors) provider + model ids. */
@Component({
  selector: 'cw-cast-panel',
  imports: [AvatarModule, TagModule, TooltipModule],
  templateUrl: './cast-panel.component.html',
  styleUrl: './cast-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CastPanelComponent {
  readonly engine = inject(PlayerEngine);

  readonly actors = computed<BundleActor[]>(() => this.engine.run()?.actors ?? []);

  identities(actor: BundleActor): Array<{ platform: string; userId: number; handle: string }> {
    return Object.entries(actor.platformIdentities ?? {}).map(([platform, identity]) => ({
      platform,
      userId: identity.userId,
      handle: identity.username ? `@${identity.username}` : identity.firstName ?? ''
    }));
  }

  initials(actor: BundleActor): string {
    const name = actor.name ?? actor.id;
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  typeSeverity(type: string): 'info' | 'success' | 'warn' | 'secondary' | 'contrast' {
    switch (type) {
      case 'ai-agent':
        return 'info';
      case 'bot':
        return 'contrast';
      case 'human':
        return 'success';
      case 'replay':
        return 'warn';
      default:
        return 'secondary';
    }
  }
}
