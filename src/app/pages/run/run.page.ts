import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { PrototypeBannerComponent } from '../../components/prototype-banner/prototype-banner.component';
import { DemoStore } from '../../demo.store';

type DetailTab = 'request' | 'response' | 'rendered' | 'state';
type InspectorPlatform = 'telegram' | 'whatsapp';

interface AssertionRow {
  assertion: string;
  expected: string;
  actual: string;
  latency: string;
  status: 'Passed';
}

@Component({
  selector: 'cw-run-page',
  imports: [
    ButtonModule,
    ProgressBarModule,
    PrototypeBannerComponent,
    RouterLink,
    TableModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './run.page.html',
  styleUrl: './run.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RunPage {
  readonly store = inject(DemoStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });
  readonly selectedPlatform = computed<InspectorPlatform>(() =>
    this.queryParamMap().get('platform') === 'whatsapp' ? 'whatsapp' : 'telegram'
  );
  readonly selectedPlatformLabel = computed(() =>
    this.selectedPlatform() === 'whatsapp' ? 'WhatsApp' : 'Telegram'
  );
  readonly traceEvents = computed(() =>
    this.selectedPlatform() === 'whatsapp'
      ? this.store.whatsappTraceEvents
      : this.store.traceEvents()
  );
  readonly selectedTraceIndex = computed(() => {
    const requestedIndex = Number(this.queryParamMap().get('event'));
    const lastIndex = Math.max(0, this.traceEvents().length - 1);
    return Number.isInteger(requestedIndex)
      ? Math.min(Math.max(requestedIndex, 0), lastIndex)
      : Math.min(2, lastIndex);
  });
  readonly detailTab = computed<DetailTab>(() => {
    const requestedTab = this.queryParamMap().get('view');
    return requestedTab === 'response' ||
      requestedTab === 'rendered' ||
      requestedTab === 'state'
      ? requestedTab
      : 'request';
  });
  readonly selectedTrace = computed(() =>
    this.traceEvents()[this.selectedTraceIndex()] ?? this.traceEvents()[0]
  );
  readonly selectedTracePayload = computed(() =>
    JSON.stringify(this.selectedTrace()?.payload ?? {}, null, 2)
  );
  readonly selectedTraceResponse = computed(() => {
    const event = this.selectedTrace();
    const payload = event?.payload;
    const response =
      payload && typeof payload === 'object' && 'response' in payload
        ? (payload as { response: unknown }).response
        : { acknowledged: true, status: event?.status ?? 'captured' };
    return JSON.stringify(response, null, 2);
  });
  readonly isRenderableMessage = computed(() => {
    const title = this.selectedTrace()?.title;
    return title === 'sendMessage' || title === 'editMessageText' || title === 'messages.create';
  });

  get assertions(): AssertionRow[] {
    if (this.selectedPlatform() === 'whatsapp') {
      return [
        {
          assertion: 'Webhook accepted',
          expected: 'within 1 s',
          actual: 'Cloud API event',
          latency: '24 ms',
          status: 'Passed'
        },
        {
          assertion: 'Reminder text',
          expected: 'contains “renews in 6 days”',
          actual: 'matched',
          latency: '—',
          status: 'Passed'
        },
        {
          assertion: 'Quick-reply actions',
          expected: '2 semantic actions',
          actual: 'open · remind tomorrow',
          latency: '12 ms',
          status: 'Passed'
        },
        {
          assertion: 'Business reply sent',
          expected: 'one Cloud API message',
          actual: 'wamid.out.1043',
          latency: '81 ms',
          status: 'Passed'
        }
      ];
    }

    return [
      {
        assertion: 'Bot message arrives',
        expected: 'within 1 s',
        actual: 'message 27',
        latency: '49 ms',
        status: 'Passed'
      },
      {
        assertion: 'Greeting text',
        expected: 'contains “Howdy stranger”',
        actual: 'matched',
        latency: '—',
        status: 'Passed'
      },
      {
        assertion: 'Language action',
        expected: 'label + semantic ID',
        actual: this.store.selectedLanguage().callbackID,
        latency: '17 ms',
        status: 'Passed'
      },
      {
        assertion: 'In-place edit',
        expected: `same ID · ${this.store.selectedLanguage().shortLabel}`,
        actual: `message 27 · v${this.store.messageVersion()}`,
        latency: this.store.messageVersion() > 1 ? '58 ms' : 'not replayed',
        status: 'Passed'
      }
    ];
  }

  selectTrace(index: number): void {
    const event = this.traceEvents()[index];
    const view: DetailTab =
      event?.title === 'sendMessage' || event?.title === 'editMessageText' || event?.title === 'messages.create'
        ? 'rendered'
        : 'request';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { event: index, platform: this.selectedPlatform(), view },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  selectDetailTab(tab: DetailTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { event: this.selectedTraceIndex(), platform: this.selectedPlatform(), view: tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
