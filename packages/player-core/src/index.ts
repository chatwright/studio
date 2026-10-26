/**
 * @chatwright/player-core — the framework-free playback surface shared by
 * Chatwright Studio and any other run-bundle consumer.
 *
 * This entry point is deliberately explicit: every public symbol is listed
 * below so the package's contract is reviewable in one place. Anything not
 * exported here is an implementation detail.
 *
 * The surface is pure: no Angular, no PrimeNG, no Firebase, no DOM, no Node
 * APIs, no timers and no runtime dependencies. Given the same bundle and the
 * same step index, the same settled state is produced.
 */

/* ------------------------------------------------------- run-bundle wire */
export { RUN_BUNDLE_FORMAT_V1 } from './bundle.types.js';
export type {
  ActionOutcomeKind,
  ActorActionOutcome,
  ActorLoopEvent,
  ActorProposal,
  ActorType,
  ActorUsage,
  ActorValidationOutcome,
  Bundle,
  BundleActor,
  BundleActorProvider,
  BundleAIGoalSection,
  BundleAnchor,
  BundleAnnotation,
  BundleAuthor,
  BundleBookmark,
  BundleChatBoundary,
  BundleChatJournal,
  BundleJournalBoundary,
  BundleMetadata,
  BundlePart,
  BundlePlatformIdentity,
  BundleRetainedObservation,
  BundleRun,
  CampaignAggregateUsage,
  CampaignEvidence,
  CampaignFinding,
  CampaignReport,
  CampaignTaskOutcome,
  DatastateEvidence,
  FindingKind,
  Freshness,
  GoalBudgets,
  GoalGoal,
  GoalTask,
  JournalDirection,
  JournalEntryKind,
  ObserveActor,
  ObserveAvailableAction,
  ObserveChange,
  ObserveChangeKind,
  ObserveObservation,
  ObserveVisibleMessage,
  PartKind,
  PlatformAction,
  PlatformJournalEntry,
  ProposalKind
} from './bundle.types.js';

/* -------------------------------------------------------- animation spec */
export { TYPING_MS_PER_CHAR, animationForBeat, animationForJournalEntry, messageKey } from './animation.js';
export type { AnimationPrimitive, AnimationSpec } from './animation.js';

/* ------------------------------------------------------------- timeline */
export { buildTimeline, chaptersOf } from './timeline.js';
export type { BeatKind, BeatStep, Chapter, JournalStep, Step } from './timeline.js';

/* ------------------------------------------------------ settled (pure) */
export { settledStateAt } from './settled.js';
export type {
  MessageVersion,
  MethodNote,
  SettledChat,
  SettledItem,
  SettledMessage,
  SettledState
} from './settled.js';

/* ---------------------------------------------------- virtual-clock tempo */
export { BASE_TEMPO, MAX_GAP_MS, MIN_GAP_MS, frameDelayMs } from './tempo.js';

/* -------------------------------------- playhead-independent derivations */
export {
  actorStats,
  attribution,
  deriveMarkers,
  findingSeverity,
  loopEventForBotMessage,
  messageLineage,
  observedByParts,
  resolveAnchorMessageKey,
  resolveAnnotations,
  threadAnnotations
} from './derive.js';
export type {
  ActionPress,
  ActorStats,
  AnnotationPin,
  AnnotationThread,
  LineageVersion,
  Marker,
  MarkerKind,
  MessageLineage,
  ObservedByRow,
  ResolvedActor
} from './derive.js';

/* --------------------------------------------------------- AI mind cursor */
export { aiCursorAt } from './ai-cursor.js';
export type { AiCursor } from './ai-cursor.js';
