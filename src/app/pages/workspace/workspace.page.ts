import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TreeModule } from 'primeng/tree';

interface RecentRun {
  id: string;
  scenario: string;
  branch: string;
  status: 'Passed' | 'Failed';
  duration: string;
  started: string;
}

@Component({
  selector: 'cw-workspace-page',
  imports: [ButtonModule, ProgressBarModule, RouterLink, TableModule, TagModule, TreeModule],
  templateUrl: './workspace.page.html',
  styleUrl: './workspace.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspacePage {
  readonly scenarioTree: TreeNode[] = [
    {
      key: 'greeting',
      label: 'Greeting & onboarding',
      expanded: true,
      icon: 'pi pi-folder-open',
      children: [
        {
          key: 'language',
          label: 'Language choice · 4/4 passing',
          icon: 'pi pi-check-circle'
        },
        {
          key: 'returning',
          label: 'Returning user · 3/3 passing',
          icon: 'pi pi-check-circle'
        }
      ]
    },
    {
      key: 'commands',
      label: 'Commands',
      expanded: true,
      icon: 'pi pi-folder-open',
      children: [
        { key: 'time', label: '/time · 2/2 passing', icon: 'pi pi-check-circle' },
        { key: 'help', label: '/help · 1 failing', icon: 'pi pi-times-circle' }
      ]
    },
    {
      key: 'recovery',
      label: 'Error recovery · draft',
      icon: 'pi pi-file-edit'
    }
  ];

  readonly recentRuns: RecentRun[] = [
    {
      id: 'run-1842',
      scenario: 'language-choice',
      branch: 'main · Telegram',
      status: 'Passed',
      duration: '342 ms',
      started: 'just now'
    },
    {
      id: 'run-1841',
      scenario: 'time-command',
      branch: 'main · Telegram',
      status: 'Passed',
      duration: '188 ms',
      started: '12 min ago'
    },
    {
      id: 'run-1839',
      scenario: 'help-fallback',
      branch: 'feature/help · Telegram',
      status: 'Failed',
      duration: '1.73 s',
      started: '43 min ago'
    }
  ];

  constructor(private readonly router: Router) {}

  openScenario(): void {
    void this.router.navigate(['/scenario']);
  }
}
