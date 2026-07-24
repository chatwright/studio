---
format: https://specscore.md/idea-specification
status: Approved
---

# Idea: Studio UI surfaces — one conversation surface, two entry points

**Status:** Approved
**Date:** 2026-07-24
**Owner:** alex
**Promotes To:** —
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

chatwright.dev/studio mixes real product (Player, Playground) with mocked
prototype pages (workspace, emulator, scenario, run) in one menu, so the
real product has no visible shape. Player and Playground read as a
confusing duplication — two chat-looking pages with different chrome. And
the live surface's name is unsettled (Playground vs Emulator), which
matters for understanding and shareability.

## Context

The Player replays run bundles (settled-fold timeline, transport bar). The
Playground runs live sessions (runtime `Session` + bot iframes, composer,
Compare mode). Both render the same underlying data — the append-only,
versioned journal — through two separate implementations today
(`settledStateAt` vs `bubble-reducer`). The glossary already canonises
**Playground** ("the manual-testing surface where human actors interact
with bots through a Platform Emulator") and retired "manual emulator" as a
spec path. Recording is a free by-product of the runtime routing
everything (decision 0012).

## Recommended Direction

### One surface — the DVR principle

Player and Playground are **one conversation surface** with a capability
flag, not two features:

- A **live session is a recording being written.** The Playground's
  journal is already a growing run bundle; "review what just happened"
  is the Player's timeline over that same journal, in place — pause a
  live conversation, scrub back, resume live. A conversation you can
  rewind is the product's most distinctive interaction (nothing in the
  bot tooling market has it).
- A **recording is a session that stopped** — and may reopen: when a
  bundle's bot is resolvable (its `CHATWRIGHT.md` names a live iframe
  URL), the Player can offer "continue live from here" — hand the
  context to a live session (initially fresh-start with the same bot;
  eventually branch-from-checkpoint via the state-branching model).

### Two entry points — because there are two share verbs

The surface is one; the doors stay two, because they are how people
*share*:

- **Player** = "**watch** this run" — the artifact link (bug reports,
  recipe evidence, demos). Opens with a recording, transport-first.
- **Playground** = "**try** this bot" — the invitation link (recipes'
  "Run it live", the README badge, Compare mode). Opens live,
  composer-first.

Distinct URLs per verb keep links self-explaining; identical surface
underneath removes the duplication feeling — like live TV vs. a video on
the same screen with the same controls.

### Naming: Playground stays; Emulator names the engine

- **Emulator** names the machinery (the glossary's Platform Emulator —
  client + server facets), not the experience. A page called Emulator
  promises internals, reads as a dev-only tool, and collides with the
  engine term. It stays powerful where it belongs: marketing copy ("a
  Telegram Bot API emulator in your browser") and the internals panel.
- **Playground** is the dev-culture word for "try it in the browser, no
  setup" (TypeScript/Go playgrounds) — an invitation, which is what a
  viral link needs. It is already the canonical glossary term.
- **Player** is the natural watch-verb word and already shipped.

### The Studio gets real: /prototypes/

The Studio menu lists only real surfaces — **Playground** and **Player**
(plus clearly-labelled stubs only when a real feature is genuinely next).
The mocked pages (workspace, emulator, scenario, run — static demo data)
move under **/prototypes/** with an honest banner ("design prototype,
static data"); old /studio/ URLs redirect. Prototypes stay visible — they
are a design asset — but never pretend to be product.

### Convergence path (implementation staging)

No big-bang merge: the two pages converge component-by-component —
shared chat-bubble surface first (the Playground's pane and the Player's
transcript), then the transport bar mounting over a live journal
(research item I-66's live-append contract), then "continue live" in the
Player. Entry points and URLs never change during convergence.

## Alternatives Considered

- **Merge into a single page/URL now.** Rejected: destroys the two share
  verbs (a "watch this" link must not open a composer-first surface),
  and forces the I-66 live-append refactor prematurely.
- **Rename Playground to Emulator.** Rejected: names the engine, not the
  experience; collides with the glossary component term; less inviting
  to share.
- **Keep two fully separate features.** Rejected: the duplication is
  real — same journal, two renderers — and the DVR interaction (scrub a
  live session) is impossible while they stay separate.

## MVP Scope

1. This document approved as the naming/IA record.
2. /prototypes/ decoupling: routes moved + redirects, real Studio menu
   (Playground, Player), prototype banner. (Executes after the current
   Playground tweak-set PR merges — same files.)
3. Glossary cross-check in the standard repository (Playground/Player
   entries already align; add "prototype" wording if needed).

## Not Doing (and Why)

- **The component convergence itself** — staged behind I-66's design
  session; this document fixes direction so convergence has a target.
- **"Continue live from here" in the Player** — needs bot resolution via
  the registry and a session-handoff design; recorded here as the
  target interaction, built later.
- **Any URL/name changes to shipped surfaces** — stability of shared
  links outranks tidiness.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|---|---|---|
| Must-be-true | Two entry points over one surface reads as clarity, not duplication, once chrome matches | Founder review of this doc; user feedback after convergence step 1 |
| Should-be-true | "Watch" and "try" links are shared to different audiences (evidence vs invitation) | Link-path analytics on /studio/player vs /studio/playground referrers |
| Might-be-true | Scrub-a-live-conversation becomes the demo moment people share | Observe first public reactions once live-append lands |

## SpecScore Integration

- **Existing Features affected:**
  [`playground`](https://github.com/chatwright/chatwright/tree/main/spec/features/chatwright/playground)
  and the player surface (standard repository feature tree); this
  repository's implementation follows.

## Open Questions

- What does the Player's "continue live from here" do about mid-recording
  state (fresh-start with the same bot vs true branch-from-checkpoint via
  state branching)?
- Does Compare mode ever need a combined two-run bundle (runs[] array)
  before the convergence work, or after?

*This document follows the https://specscore.md/idea-specification*
