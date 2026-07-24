import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import {
  GREETBOT_ACTOR_ID,
  GREETBOT_SCENARIO,
  buildRunBundle,
  parseScenarioManifest,
  type CampaignReport,
  type PartOutcome,
  type Provider,
  type ScenarioManifest,
  type Session
} from '@chatwright/runtime';

import { SettingsStore } from '../../../settings.store';
import type { SettingsProviderMode } from '../../../settings-persistence';
import type { ConnectionStatus } from '../chat-pane/chat-pane.component';
import { AiRunnerService } from './ai-runner.service';
import { buildGreetbotTestRun } from './greetbot-test-run';
import {
  DEFAULT_SERVER_ADDRESS,
  buildByokProvider,
  buildLocalProvider,
  detectLocalServer,
  withStopSignal,
  type ServerHealth
} from './provider-source';
import { resolveManifestRun } from './scenario-manifest';

type ScenarioSource = 'greetbot' | 'document';
type ServerCheckState = 'checking' | 'available' | 'unavailable';

/**
 * The "AI test" tab's control panel: the provider-mode selector (BYOK /
 * Local AI / Cloud) + its settings, the scenario picker (built-in greetbot,
 * or a loaded scenario document), Run/Stop, the live step/budget meter and
 * assertion chips, and the final campaign report + Download bundle/Open in
 * Player.
 *
 * @remarks
 * Owns none of the conversation itself — `session()` is the SAME
 * `@chatwright/runtime` `Session` the sibling `<cw-chat-pane>` is already
 * driving (see `playground.page.html`'s `ai-test` case, and
 * `ChatPaneComponent.session`'s own doc comment for why that pane exposes
 * it). This panel only builds a `Run` over that session and hands it to its
 * own component-scoped `AiRunnerService`; the pane's already-subscribed
 * journal is what renders the live transcript — this panel never touches
 * the DOM transcript directly.
 */
@Component({
  selector: 'cw-ai-test-panel',
  imports: [ButtonModule, InputTextModule, ProgressBarModule, TagModule, TooltipModule],
  providers: [AiRunnerService],
  templateUrl: './ai-test-panel.component.html',
  styleUrl: './ai-test-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiTestPanelComponent {
  readonly store = inject(SettingsStore);
  readonly runner = inject(AiRunnerService);

  /** The pane's live `Session` — `undefined` before `ChatPaneComponent.connect()` has constructed one. */
  readonly session = input<Session | undefined>(undefined);
  /** The pane's own connection status — Run stays disabled until it is `'connected'`. */
  readonly paneStatus = input<ConnectionStatus>('handshaking');

  readonly greetbotScenarioTitle = GREETBOT_SCENARIO.title;
  readonly defaultServerAddress = DEFAULT_SERVER_ADDRESS;

  readonly scenarioSource = signal<ScenarioSource>('greetbot');
  readonly manifestFileName = signal<string | null>(null);
  readonly manifestErrors = signal<readonly string[] | null>(null);
  readonly parsedManifest = signal<ScenarioManifest | null>(null);

  readonly serverCheck = signal<ServerCheckState>('checking');
  readonly serverHealth = signal<ServerHealth | null>(null);
  readonly apiKeyVisible = signal(false);
  readonly preflightError = signal<string | null>(null);

  /** The model label attached to the run bundle's provider provenance — set at the moment a run starts, so a later settings edit never rewrites a past run's own report. */
  private lastRunModelLabel = signal<string | null>(null);

  readonly scenarioReady = computed(
    () => this.scenarioSource() === 'greetbot' || this.parsedManifest() !== null
  );

  readonly canRun = computed(
    () =>
      this.session() !== undefined &&
      this.paneStatus() === 'connected' &&
      this.runner.status() !== 'running' &&
      this.store.providerMode() !== 'cloud' &&
      this.scenarioReady()
  );

  readonly isRunning = computed(() => this.runner.status() === 'running');

  readonly campaignReport = computed<CampaignReport | null>(() => {
    const result = this.runner.result();
    if (!result) return null;
    const aiGoalPart: PartOutcome | undefined = result.parts.find((part) => part.aiGoal !== undefined);
    return aiGoalPart?.aiGoal?.report ?? null;
  });

  readonly stepBudgetPercent = computed(() => {
    const snapshot = this.runner.loopSnapshot();
    const maxSteps = snapshot?.budgets.maxSteps ?? 0;
    if (!snapshot || maxSteps <= 0) return 0;
    return Math.min(100, Math.round((snapshot.iteration / maxSteps) * 100));
  });

  constructor() {
    // Re-probe the companion server whenever its address changes; also runs
    // once at construction with the persisted/default address.
    effect(() => {
      const address = this.store.serverAddress();
      void this.checkServer(address);
    });
  }

  selectMode(mode: SettingsProviderMode): void {
    this.store.setProviderMode(mode);
    this.preflightError.set(null);
  }

  onByokBaseURLChange(event: Event): void {
    this.store.setByok({ baseURL: (event.target as HTMLInputElement).value });
  }

  onByokModelChange(event: Event): void {
    this.store.setByok({ model: (event.target as HTMLInputElement).value });
  }

  onByokApiKeyChange(event: Event): void {
    this.store.setByok({ apiKey: (event.target as HTMLInputElement).value });
  }

  onLocalModelChange(event: Event): void {
    this.store.setLocal({ model: (event.target as HTMLInputElement).value });
  }

  onServerAddressChange(event: Event): void {
    this.store.setServerAddress((event.target as HTMLInputElement).value);
  }

  toggleApiKeyVisible(): void {
    this.apiKeyVisible.update((visible) => !visible);
  }

  onScenarioSourceChange(source: ScenarioSource): void {
    this.scenarioSource.set(source);
    this.preflightError.set(null);
  }

  async onManifestFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.manifestFileName.set(file.name);
    this.parsedManifest.set(null);
    this.manifestErrors.set(null);

    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      this.manifestErrors.set([`Could not read that file — ${err instanceof Error ? err.message : String(err)}`]);
      return;
    }

    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch (err) {
      this.manifestErrors.set([`That file is not valid JSON — ${err instanceof Error ? err.message : String(err)}`]);
      return;
    }

    // Pure validation only — never starts a bot (see parseScenarioManifest's own doc comment).
    const parsed = parseScenarioManifest(document);
    if (!parsed.ok) {
      this.manifestErrors.set(parsed.errors.map((error) => `${error.code}: ${error.message}`));
      return;
    }
    this.parsedManifest.set(parsed.manifest);
  }

  async run(): Promise<void> {
    this.preflightError.set(null);
    const session = this.session();
    if (!session) {
      this.preflightError.set('The bot pane is not ready yet — wait for it to connect.');
      return;
    }

    const providerResult = this.resolveProvider();
    if (!providerResult.ok) {
      this.preflightError.set(providerResult.error);
      return;
    }

    const provider = withStopSignal(providerResult.provider, () => this.runner.stopRequested());
    const now = () => Date.now();

    const runResult =
      this.scenarioSource() === 'greetbot'
        ? { ok: true as const, run: buildGreetbotTestRun(session, { now, provider }) }
        : this.resolveManifest(session, provider, now);

    if (!runResult.ok) {
      this.preflightError.set(runResult.error);
      return;
    }

    this.lastRunModelLabel.set(providerResult.modelLabel);
    await this.runner.run(runResult.run);
  }

  stop(): void {
    this.runner.stop();
  }

  /** `buildRunBundle` → Blob → download; returns the file name for the caller's own note. */
  downloadBundle(): string | undefined {
    const session = this.session();
    const result = this.runner.result();
    if (!session || !result) return undefined;

    const modelLabel = this.lastRunModelLabel();
    const bundle = buildRunBundle(session, result, {
      providers: modelLabel ? { [GREETBOT_ACTOR_ID]: { name: this.store.providerMode(), modelIds: [modelLabel] } } : undefined
    });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `ai-test-${stamp}.chatwright.json`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return fileName;
  }

  /** Downloads the bundle, then opens /player in a new tab — same "drop the file onto it" hand-off `ChatPaneComponent.replayInPlayer()` already uses. */
  openInPlayer(): void {
    const fileName = this.downloadBundle();
    if (!fileName) return;
    const playerUrl = new URL('player', document.baseURI).href;
    window.open(playerUrl, '_blank', 'noopener');
  }

  private async checkServer(address: string): Promise<void> {
    this.serverCheck.set('checking');
    const health = await detectLocalServer(fetch, address);
    this.serverHealth.set(health);
    this.serverCheck.set(health ? 'available' : 'unavailable');
  }

  private resolveProvider(): { ok: true; provider: Provider; modelLabel: string } | { ok: false; error: string } {
    const mode = this.store.providerMode();
    if (mode === 'byok') {
      const result = buildByokProvider({ baseURL: this.store.byokBaseURL(), model: this.store.byokModel(), apiKey: this.store.byokApiKey() });
      return result.ok ? { ok: true, provider: result.provider, modelLabel: this.store.byokModel().trim() } : result;
    }
    if (mode === 'local') {
      if (this.serverCheck() !== 'available') {
        return { ok: false, error: "Local AI isn't available — run `chatwright server start`, then try again." };
      }
      const result = buildLocalProvider(this.store.serverAddress(), this.store.localModel());
      return result.ok ? { ok: true, provider: result.provider, modelLabel: this.store.localModel().trim() } : result;
    }
    return { ok: false, error: 'Cloud is coming soon — choose BYOK or Local AI to run a test today.' };
  }

  private resolveManifest(
    session: Session,
    provider: Provider,
    now: () => number
  ): { ok: true; run: ReturnType<typeof buildGreetbotTestRun> } | { ok: false; error: string } {
    const manifest = this.parsedManifest();
    if (!manifest) {
      return { ok: false, error: 'Load a valid scenario document first.' };
    }
    return resolveManifestRun(session, manifest, { now, provider });
  }
}
