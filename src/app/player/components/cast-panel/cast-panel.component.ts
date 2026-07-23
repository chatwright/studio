import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { ActorStats, actorStats } from '../../engine/derive';
import { BundleActor } from '../../model/bundle.types';
import { PlayerEngine } from '../../player-engine';

/**
 * Cast tab (moved here from the left): the run's actors roster. Each actor is
 * clickable, expanding to per-actor stats computed from the bundle — messages
 * sent, clicks/callbacks, edits received, and for AI actors token usage, call
 * count and models (round 2, item 1).
 */
@Component({
  selector: 'cw-cast-panel',
  imports: [AvatarModule, TagModule, TooltipModule],
  templateUrl: './cast-panel.component.html',
  styleUrl: './cast-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CastPanelComponent {
  readonly engine = inject(PlayerEngine);
  private readonly expanded = signal<Set<string>>(new Set());

  readonly actors = computed<BundleActor[]>(() => this.engine.run()?.actors ?? []);

  stats(actor: BundleActor): ActorStats {
    const run = this.engine.run();
    return run
      ? actorStats(run, actor)
      : {
          messagesSent: 0,
          clicks: 0,
          editsReceived: 0,
          isAI: false,
          inputTokens: 0,
          outputTokens: 0,
          calls: 0,
          models: []
        };
  }

  isExpanded(actor: BundleActor): boolean {
    return this.expanded().has(actor.id);
  }

  toggle(actor: BundleActor): void {
    const next = new Set(this.expanded());
    if (next.has(actor.id)) {
      next.delete(actor.id);
    } else {
      next.add(actor.id);
    }
    this.expanded.set(next);
  }

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
