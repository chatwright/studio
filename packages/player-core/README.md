# @chatwright/player-core

The framework-free playback core for [Chatwright](https://chatwright.dev) run
bundles. It turns a run bundle into a deterministic, ordered timeline, folds
that timeline into settled transcript state at any step index, and carries a
timer-free presentation cursor with caller-gated external waits.

This package is the single implementation used by Chatwright Studio's Player. It
is also the reusable surface for other run-bundle consumers that need to replay a
recorded conversation without adopting Angular, PrimeNG, Firebase, cloud saving
or Studio's UI components.

## Why it exists

Playback is a presentation concern, but its core is not a UI concern. Two
properties must hold for every consumer:

1. **Determinism.** The same bundle and the same step index produce the same
   settled state, however the playhead reached that index — play, single step,
   keyboard navigation or a direct seek.
2. **Separation.** The animation layer decides *what* should animate; the host
   decides *when* and *how* it renders. The pure core never owns timers, an
   animation frame, the DOM or Angular signals.

The package was extracted from Studio rather than reimplemented: existing Studio
engine regression tests and the packaged-consumer proof both exercise this code.

## Install and use

```bash
pnpm add @chatwright/player-core
```

```ts
import {
  buildTimeline,
  chaptersOf,
  settledStateAt,
  type BundleRun
} from '@chatwright/player-core';

const timeline = buildTimeline(run satisfies BundleRun);
const chapters = chaptersOf(timeline);
const transcript = settledStateAt(timeline, timeline.length - 1);

console.log(transcript.messageCount, chapters.length);
```

The package has **no runtime dependencies** and ships compiled ESM plus
self-contained TypeScript declarations. It uses no DOM or Node-specific types in
its public API.

## Public API

The root entry point is explicit; every public symbol is listed in
[`src/index.ts`](src/index.ts).

### Run-bundle wire types

`Bundle`, `BundleRun`, `BundlePart`, `BundleActor`, `PlatformJournalEntry`,
`PlatformAction`, `ActorLoopEvent`, `ObserveObservation`, `BundleAnnotation`,
`BundleBookmark`, `BundleAnchor`, `CampaignReport`, `DatastateEvidence` and the
related string-enum types, plus `RUN_BUNDLE_FORMAT_V1`. These are the TypeScript
mirror of the published run-bundle v1 wire contract. They are types only; this
package does not validate or mutate a bundle.

### Timeline

- `buildTimeline(run)` — pure, deterministic step list ordered by
  `[partIndex, atMs, lane, construction order]`.
- `chaptersOf(timeline)` — contiguous step ranges per part.
- `Step`, `JournalStep`, `BeatStep`, `BeatKind`, `Chapter`.

### Settled state

- `settledStateAt(timeline, index)` — pure fold of journal steps up to and
  including `index`. Applies edits in place, records version history and presses,
  marks deletions and keeps uncaptured-method notes.
- `SettledState`, `SettledChat`, `SettledItem`, `SettledMessage`,
  `MessageVersion`, `MethodNote`.

### Animation specification

- `animationForJournalEntry`, `animationForBeat`, `messageKey`,
  `TYPING_MS_PER_CHAR`.
- `AnimationSpec`, `AnimationPrimitive`.

These functions choose a declarative primitive and a nominal duration. They do
not play anything and never read wall-clock time. The host owns pacing, native
timers, `requestAnimationFrame` and reduced-motion behaviour.

### Tempo

- `BASE_TEMPO`, `MIN_GAP_MS`, `MAX_GAP_MS`, `frameDelayMs(gapMs, speed)`.

The virtual-clock pacing function is pure so a host can apply the same speed
scale without copying arithmetic.

### Playhead-independent derivations

- `attribution`, `messageLineage`, `loopEventForBotMessage`, `observedByParts`,
  `actorStats`, `deriveMarkers`, `findingSeverity`, `resolveAnnotations`,
  `threadAnnotations`, `resolveAnchorMessageKey`.
- `Marker`, `AnnotationPin`, `AnnotationThread`, `MessageLineage`, `ActorStats`,
  `ObservedByRow`, `ResolvedActor` and related types.

These describe the whole run, not a playhead position: provenance lineage,
roster attribution, anchor resolution, annotation threads and derived markers.
Resolution is tolerant — a dangling anchor or unknown reply target is flagged,
never thrown.

### AI mind cursor

- `aiCursorAt(timeline, index)` — the active part, last revealed event/beat and
  revealed event indexes at a step index.

### Presentation transport and external waits

- `PresentationTransport` — a pure cursor over the timeline with caller-declared
  `PresentationSegment` ranges and `PresentationBarrier` step bindings.
- `PresentationState`, `PresentationStatus`, `PresentationWaitTicket` — the
  current cursor, status, active segment and opaque ticket.

`advance()` moves one step or stops at an unreleased barrier with a live ticket.
A host may schedule the next tick only while `state.canAdvance` is true; that
admission includes the tick that opens a wait or reaches `segment-end`/`ended`,
so terminal transitions are reached without an undocumented extra advance.
Doing nothing keeps a wait waiting. `releaseWait(ticket)` accepts only the exact
current ticket object, once; it marks the wait satisfied but never advances,
schedules a frame or restarts playback. `seek()` is a watch operation: it may
preview anywhere, revokes any open ticket and never opens one. `enterSegment()`
is the explicit outer Next at a segment end. `reset()` and `dispose()` revoke
the current lifetime.

The caller-declared plan is validated and frozen at construction.
`transport.bindings` exposes that snapshot for a host that must retain the plan
across a later rebuild: keep the snapshot, never the caller's mutable arrays or
records, so a later edit cannot relocate a barrier or change a segment range.

The caller owns validation. It constructs and matches its own context and
envelope, then releases the ticket only after accepting a matching complete
whole-challenge pass. The package never sees a project, attempt, checkpoint
payload, outcome, SQL, evidence or transcript, and keeps no completion registry.

The package also keeps no consumption ledger. A host that needs once-only
acceptance across presentation-wait recreation keeps its own finite,
non-evicting set keyed by the full immutable result identity (including attempt
and submission generation), plus an optional idempotent credit mapping keyed by
context/checkpoint when it reports learner progress. The proof harness
demonstrates both caller-owned structures, including fail-closed capacity
exhaustion; neither is exported by the package.

```ts
import { PresentationTransport } from '@chatwright/player-core';

const transport = new PresentationTransport(timeline.length, {
  segments: [{ id: 'brief', startIndex: 0, endIndex: 3 }],
  barriers: [{ id: 'result', segmentId: 'brief', atIndex: 2 }]
});

const state = transport.advance(); // … eventually: status 'waiting'
if (state.wait && callerAcceptedItsOwnResult) {
  transport.releaseWait(state.wait); // exactly once, no automatic resume
}
```

## What is deliberately not here

- Angular services, signals, components, templates and styles.
- PrimeNG, Firebase, authentication, quotas or cloud saving.
- Native timers, `requestAnimationFrame`, DOM measurement or event handling.
- Bundle parsing/validation policy, scenario execution, grading, wire-format
  changes or a training/navigation manifest.
- Checkpoint envelope parsing, outcome interpretation, completion registries or
  learner progress. A wait ticket is an opaque presentation capability; the
  caller decides what it means.
- Any DataTug workflow or chapter ownership. `walkthrough.json` remains
  DataTug's sole chapter/navigation owner; this package has no second manifest.

## Extraction decision

Studio's Player was already split into a pure layer (`engine/*`) and an Angular
`PlayerEngine` wrapper. Moving the pure layer into `packages/player-core` keeps
the wrapper (signals, native timers, animation-frame presentation, chat pinning
and UI state) in Studio while giving other consumers the same deterministic
implementation. A second live copy would drift; thin re-exports are not needed
because Studio imports the package directly.

The canonical design note, boundaries and proof record live in
[Chatwright Playground — playback core](https://github.com/chatwright/chatwright/blob/main/spec/features/chatwright/playground/playback-core/README.md).

## Proof

Four independent checks exercise the public contract:

- `pnpm --filter @chatwright/player-core test` builds the package and runs
  `node --test` against the compiled `dist/` exports, including the transport's
  barrier, ticket, seek, reset, disposal and documented-`canAdvance` host
  transition semantics.
- `pnpm prove:player-core` (from the Studio repository root) builds and packs the
  package, inspects the tarball, installs it into a fresh temporary consumer
  outside the repository, then runs a 25-check runtime proof and a TypeScript
  declaration proof against that tarball alone. The runtime proof covers
  caller-owned envelope and required-part fencing, structural-clone replay
  rejection across a recreated wait, fail-closed finite-capacity consumption,
  a stale/failed release leaving a valid result unconsumed, fresh-generation
  acceptance versus one idempotent checkpoint credit, raw catalogue byte
  length/SHA-256 pins, and verified English/French fixture messages entering
  `buildTimeline`, `settledStateAt` and the animation specification with the
  locale text and typing duration changing while grading identities do not.
- `pnpm prove:player-core-browser` builds, packs and installs the same way,
  serves only the consumer's files on an ephemeral loopback port and drives a
  real Chromium browser through 47 checks and 12 screenshots: Play, waiting,
  assisted pass, recreated-wait structural-clone replay rejection, fresh
  attempt acceptance, stale result, ledger capacity exhaustion, Watch/seek,
  explicit Next, stored-completion revisit and duplicate release. Assertions
  read the settled transcript and caller-owned effect/acceptance/consumption/
  credit counters. SIGINT and SIGTERM use the same idempotent awaited shutdown
  as the normal `finally`.
- `node --test scripts/player-core-proof/browser-lifecycle.test.mjs` proves
  interrupted, repeated and partially failing shutdown in child processes,
  including that the owned loopback port is gone.

The browser proof is a synthetic caller-side fencing proof, not a production
DataTug adapter or grading claim.

## Licence

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). The package contains
only first-party Chatwright code; its runtime dependency closure is empty.
