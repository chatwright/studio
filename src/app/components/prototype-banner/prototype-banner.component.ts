import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The honest banner every `/prototypes/*` page renders (studio-ui-surfaces.md,
 * MVP Scope item 2 — "prototypes stay visible... but never pretend to be
 * product"). Deliberately a plain local `signal`, not persisted: each
 * prototype page mounts its own instance, so dismissing it on one page
 * doesn't need to remember anything for the next — a visitor who follows
 * the "Design prototypes" section more than once will see it again, which
 * is the point (it's a standing disclaimer, not a one-time tip).
 */
@Component({
  selector: 'cw-prototype-banner',
  imports: [RouterLink],
  templateUrl: './prototype-banner.component.html',
  styleUrl: './prototype-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrototypeBannerComponent {
  readonly dismissed = signal(false);

  dismiss(): void {
    this.dismissed.set(true);
  }
}
