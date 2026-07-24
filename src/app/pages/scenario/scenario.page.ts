import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PrototypeBannerComponent } from '../../components/prototype-banner/prototype-banner.component';

@Component({
  selector: 'cw-scenario-page',
  imports: [ButtonModule, ProgressBarModule, PrototypeBannerComponent, RouterLink, TagModule, TooltipModule],
  templateUrl: './scenario.page.html',
  styleUrl: './scenario.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScenarioPage {
  readonly draftGreetingExpectationVisible = signal(false);
  readonly draftUpdateExpectationVisible = signal(false);

  addExpectation(target: 'greeting' | 'update'): void {
    const draft = target === 'greeting'
      ? this.draftGreetingExpectationVisible
      : this.draftUpdateExpectationVisible;
    draft.set(true);
  }
}
