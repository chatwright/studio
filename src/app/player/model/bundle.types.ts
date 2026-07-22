/**
 * TypeScript mirror of the Chatwright run-bundle format v1 wire contract.
 *
 * Canonical schema: chatwright/formats/run-bundle/v1/schema.json.
 * Wrapper/document fields are camelCase; embedded module types
 * (journal entries, loop events, observations) are PascalCase exactly as the
 * Go structs serialise them. Render what the schema says, not what reads
 * natural — see the schema's own $comment.
 *
 * Every field a consumer might touch is optional-tolerant: a hand-edited
 * bundle can omit, reorder or add fields. Decoding never rejects unknown
 * fields (forward-compatible), and dangling anchors/replyTo are a consumer
 * concern, never a decode error.
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

/** PascalCase — embedded platform.JournalEntry, carried verbatim. */
export type JournalDirection = 'user' | 'bot';
export type JournalEntryKind = 'message' | 'action' | 'uncaptured';

export interface PlatformAction {
  Label: string;
  ID: string;
  URL: string;
}

export interface PlatformJournalEntry {
  Direction: JournalDirection;
  Kind: JournalEntryKind;
  /** Logical message identity shared across versions; 0 when the kind has none. */
  MessageID: number;
  /** Action entries only: the message the action targeted. */
  RefMessageID: number;
  /** Message entries only: 0 = original, N = the Nth edit. */
  Version: number;
  Text: string;
  /** Message entries only: rows/cols of attached buttons. */
  Actions: PlatformAction[][] | null;
  /** Uncaptured entries only: the Bot API method name that was called. */
  Method: string;
  At: string;
  /** Platform-native originator id; 0 when unknown. Resolves via roster. */
  FromID: number;
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
  ID: string;
  Title: string;
  Description: string;
  Tasks: GoalTask[] | null;
  Constraints: string[] | null;
  Budgets: GoalBudgets;
}

export interface GoalTask {
  ID: string;
  Title: string;
  DependsOn: string[] | null;
  SuccessCriteria: string;
  Milestones: string[] | null;
}

export interface GoalBudgets {
  MaxSteps: number;
  MaxDuration: number;
  MaxRepeatedFailures: number;
  MaxCost: number | null;
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
  Index: number;
  At: string;
  TaskID: string;
  ObservationSequence: number;
  Proposal: ActorProposal;
  Usage: ActorUsage;
  Validation: ActorValidationOutcome;
  Action: ActorActionOutcome;
}

export interface ActorProposal {
  Kind: ProposalKind;
  Text: string;
  ActionID: string;
  ObservationSequence: number;
  Rationale: string;
}

export interface ActorUsage {
  Model: string;
  InputTokens: number;
  OutputTokens: number;
  /** Nanoseconds (Go time.Duration). */
  Latency: number;
  cost?: number;
}

export interface ActorValidationOutcome {
  Checked: boolean;
  Verdict: Verdict;
  Reason: string;
}

export interface ActorActionOutcome {
  Kind: ActionOutcomeKind;
  Detail: string;
}

export interface BundleRetainedObservation {
  sequence: number;
  observation: ObserveObservation;
}

export type ObserveActor = 'user' | 'bot';
export type ObserveChangeKind = 'new-message' | 'edited-message' | 'actions-changed' | string;

export interface ObserveObservation {
  Sequence: number;
  PreviousSequence: number;
  Chat: { ChatID: number };
  Messages: ObserveVisibleMessage[] | null;
  Changes: ObserveChange[] | null;
}

export interface ObserveVisibleMessage {
  ID: string;
  Version: number;
  Edited: boolean;
  Actor: ObserveActor;
  Text: string;
  Actions: ObserveAvailableAction[] | null;
}

export interface ObserveAvailableAction {
  ID: string;
  Label: string;
  SeenAt: number;
}

export interface ObserveChange {
  Kind: ObserveChangeKind;
  MessageID: string;
  Actor: ObserveActor;
  PreviousVersion: number;
  Version: number;
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
  Name: string;
  AttachmentPoint: string;
  Holder: string;
  Query: string;
  Params: Record<string, unknown> | null;
  Outcome: string;
  FailureMessage: string;
  TotalRows: number;
  ReturnedRows: number;
  Truncated: boolean;
  Preview: Array<Record<string, unknown>> | null;
  RedactedFields: string[] | null;
  ExcludedFields: string[] | null;
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
