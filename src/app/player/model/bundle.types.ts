/**
 * TypeScript mirror of the Chatwright run-bundle format v1 wire contract.
 *
 * Canonical schema: chatwright/formats/run-bundle/v1/schema.json. As of the
 * upstream "normalise entire run-bundle wire to camelCase" change, EVERY wire
 * field is camelCase — the previously PascalCase embedded module types
 * (journal entries, platform actions, loop events, observations, goals,
 * datastate evidence) are now camelCase too. String enum *values* are
 * unchanged.
 *
 * Decoding stays forward-compatible: unknown fields are ignored and dangling
 * anchors/replyTo are a consumer concern, never a decode error.
 */

export const RUN_BUNDLE_FORMAT_V1 = 'https://chatwright.dev/formats/run-bundle/v1';

/** Top-level run-bundle document. */
export interface Bundle {
  format: string;
  metadata: BundleMetadata;
  runs: BundleRun[] | null;
}

export interface BundleMetadata {
  createdAt: string;
  chatwrightVersion?: string;
  author?: BundleAuthor;
}

export interface BundleAuthor {
  name?: string;
  email?: string;
}

export interface BundleRun {
  id: string;
  platform: string;
  endpointProfile: string;
  actors: BundleActor[] | null;
  chats: BundleChatJournal[] | null;
  parts: BundlePart[] | null;
  bookmarks?: BundleBookmark[];
  annotations?: BundleAnnotation[];
}

export type ActorType = 'ai-agent' | 'human' | 'scripted' | 'replay' | 'bot' | string;

export interface BundleActor {
  id: string;
  type: ActorType;
  name?: string;
  platformIdentities?: Record<string, BundlePlatformIdentity>;
  provider?: BundleActorProvider;
}

export interface BundlePlatformIdentity {
  userId: number;
  username?: string;
  firstName?: string;
}

export interface BundleActorProvider {
  name?: string;
  modelIds?: string[];
}

export interface BundleChatJournal {
  chatId: number;
  entries: PlatformJournalEntry[] | null;
}

export type JournalDirection = 'user' | 'bot';
export type JournalEntryKind = 'message' | 'action' | 'uncaptured';

export interface PlatformAction {
  label: string;
  id: string;
  url: string;
}

export interface PlatformJournalEntry {
  direction: JournalDirection;
  kind: JournalEntryKind;
  /** Logical message identity shared across versions; 0 when the kind has none. */
  messageId: number;
  /** Action entries only: the message the action targeted. */
  refMessageId: number;
  /** Message entries only: 0 = original, N = the Nth edit. */
  version: number;
  text: string;
  /** Message entries only: rows/cols of attached buttons. */
  actions: PlatformAction[][] | null;
  /** Uncaptured entries only: the Bot API method name that was called. */
  method: string;
  at: string;
  /** Platform-native originator id; 0 when unknown. Resolves via roster. */
  fromId: number;
}

export type PartKind = 'ai-goal' | 'deterministic' | string;

export interface BundlePart {
  id: string;
  title?: string;
  kind: PartKind;
  journalBoundary: BundleJournalBoundary;
  aiGoal?: BundleAIGoalSection;
}

export interface BundleJournalBoundary {
  chats: BundleChatBoundary[] | null;
}

export interface BundleChatBoundary {
  chatId: number;
  firstEntry: number;
  entryCount: number;
}

export interface BundleAIGoalSection {
  goal: GoalGoal;
  actorId: string;
  events: ActorLoopEvent[] | null;
  observations: BundleRetainedObservation[] | null;
  report: CampaignReport;
  evidence?: DatastateEvidence[];
}

export interface GoalGoal {
  id: string;
  title: string;
  description: string;
  tasks: GoalTask[] | null;
  constraints: string[] | null;
  budgets: GoalBudgets;
}

export interface GoalTask {
  id: string;
  title: string;
  dependsOn: string[] | null;
  successCriteria: string;
  milestones: string[] | null;
}

export interface GoalBudgets {
  maxSteps: number;
  maxDurationNanoseconds: number;
  maxRepeatedFailures: number;
  maxCost: number | null;
}

export type ProposalKind = 'send-text' | 'click' | 'task-done' | 'give-up' | string;
export type ActionOutcomeKind =
  | 'skipped-invalid'
  | 'executed'
  | 'executed-no-effect'
  | 'resolution-failed'
  | 'task-completed'
  | 'task-given-up'
  | string;
export type Verdict = '' | 'fresh' | 'stale' | string;

export interface ActorLoopEvent {
  index: number;
  at: string;
  taskId: string;
  observationSequence: number;
  proposal: ActorProposal;
  usage: ActorUsage;
  validation: ActorValidationOutcome;
  action: ActorActionOutcome;
}

export interface ActorProposal {
  kind: ProposalKind;
  text: string;
  actionId: string;
  observationSequence: number;
  rationale: string;
}

export interface ActorUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Latency in nanoseconds (Go time.Duration). */
  latencyNanoseconds: number;
  cost?: number;
}

export interface ActorValidationOutcome {
  checked: boolean;
  verdict: Verdict;
  reason: string;
}

export interface ActorActionOutcome {
  kind: ActionOutcomeKind;
  detail: string;
}

export interface BundleRetainedObservation {
  sequence: number;
  observation: ObserveObservation;
}

export type ObserveActor = 'user' | 'bot';
export type ObserveChangeKind = 'new-message' | 'edited-message' | 'actions-changed' | string;

export interface ObserveObservation {
  sequence: number;
  previousSequence: number;
  chat: { chatId: number };
  messages: ObserveVisibleMessage[] | null;
  changes: ObserveChange[] | null;
}

export interface ObserveVisibleMessage {
  id: string;
  version: number;
  edited: boolean;
  actor: ObserveActor;
  text: string;
  actions: ObserveAvailableAction[] | null;
}

export interface ObserveAvailableAction {
  id: string;
  label: string;
  seenAt: number;
}

export interface ObserveChange {
  kind: ObserveChangeKind;
  messageId: string;
  actor: ObserveActor;
  previousVersion: number;
  version: number;
}

export interface CampaignReport {
  schemaVersion: number;
  goalId: string;
  goalTitle: string;
  stopReason: string;
  steps: number;
  cost?: number;
  elapsedNanoseconds: number;
  tasks: CampaignTaskOutcome[] | null;
  findings: CampaignFinding[] | null;
  usage: CampaignAggregateUsage;
}

export interface CampaignTaskOutcome {
  taskId: string;
  title?: string;
  successCriteria?: string;
  status: string;
  attempted: boolean;
  failureCount: number;
}

export type FindingKind = 'verified-defect' | 'ai-navigation-failure' | 'coverage-gap' | string;

export interface CampaignFinding {
  kind: FindingKind;
  taskId: string;
  summary: string;
  evidence: CampaignEvidence;
  confidence?: string;
}

export interface CampaignEvidence {
  observationSequences?: number[];
  loopEventIndexes?: number[];
}

export interface CampaignAggregateUsage {
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  callCount: number;
}

export interface DatastateEvidence {
  name: string;
  attachmentPoint: string;
  holder: string;
  query: string;
  params: Record<string, unknown> | null;
  outcome: string;
  failureMessage: string;
  totalRows: number;
  returnedRows: number;
  truncated: boolean;
  preview: Array<Record<string, unknown>> | null;
  redactedFields: string[] | null;
  excludedFields: string[] | null;
}

export interface BundleBookmark {
  id: string;
  title: string;
  anchor: BundleAnchor;
}

export interface BundleAnnotation {
  id: string;
  anchor: BundleAnchor;
  author?: BundleAuthor;
  createdAt: string;
  text: string;
  replyTo?: string;
}

export interface BundleAnchor {
  chatId: number;
  entryIndex: number;
  messageId?: number;
  version?: number;
}
