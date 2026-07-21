# Chatwright Studio

Private source for the Chatwright Studio web experience. The current application
is a connected zoneless Angular 22 + PrimeNG 22 prototype built with Angular
Signals and static sample data.

The long-term product connects to an authenticated Chatwright CLI server on the
local machine. That local-first bridge lets a developer move from terminal output
to the visual Studio without uploading private run data. Cloud persistence,
sharing and collaboration remain explicit follow-on actions.

## Run

```bash
pnpm install
cp .env.example .env.local
# Add PRIMEUI_LICENSE to .env.local.
pnpm start
```

Open [http://localhost:4200](http://localhost:4200). Production compilation:

```bash
pnpm build
```

## Deploy the prototype

The production prototype is mounted at
[https://chatwright.dev/prototype/](https://chatwright.dev/prototype/). Angular
builds with `/prototype/` as its base href, and a small Cloudflare Worker strips
that mount prefix before serving static assets with SPA fallback. The
`chatwright-dev` Worker owns `chatwright.dev` as a Custom Domain; `/` serves a
small standalone placeholder while `/prototype/` opens the live emulator.

```bash
pnpm deploy:dry-run
pnpm deploy:cloudflare
```

Pushes to `main` call the shared
[`sneat-co/cicd` Cloudflare workflow](https://github.com/sneat-co/cicd/blob/main/.github/workflows/cf-deploy.yml).
The repository needs `CLOUDFLARE_API_TOKEN` and `PRIMEUI_LICENSE` secrets plus a
`CLOUDFLARE_ACCOUNT_ID` Actions variable.

## Connected mock-ups

| View | Route | Primary question |
|---|---|---|
| Workspace | `/workspace` | Can users understand hierarchy, coverage and the next useful action? |
| Live emulator (default) | `/emulator` | Can several actor/chat contexts stay legible while all actions use one run? |
| Scenario | `/scenario` | Can conversational intent and executable assertions read as one specification? |
| Run inspector | `/run` | Can a failure or edit be explained from transcript, trace and metrics without a debugger? |

All views refer to the same workspace, `greetbot/language-choice` scenario and
`run-1842`. Links between them preserve that mental context.

## Dynamic interaction

In the live emulator, select one of the four Telegram inline language actions. The
reply text changes in place, its version increments, an “edited” marker appears,
and a matching `editMessageText` event is added to the trace rail. User messages
can also be sent through the composer. Hover a trace event for formatted JSON or
click it to open the correlated full inspector; message events open directly in
the rendered representation tab. Reset returns the run to the English v1 state.

The live-emulator mock is a consumer of a Telegram Platform Emulator. In this
static prototype the platform/runtime data is illustrative; in the product, the
emulator—not the UI—owns Telegram updates, Bot API behaviour and chat state while
the bot under development remains real.

## Design intent

- PrimeNG 22 provides buttons, tags, avatars, progress bars, trees,
  tables and tooltips; layout/brand CSS remains prototype-specific.
- Chatwright starts light while the Telegram emulator starts dark. The header
  switch inverts those themes to keep the product and tested platform distinct.
- The UI deliberately shows fidelity (`HTTP`, `Telegram`, `faithful`) and marks
  AI authoring as future rather than implying it exists today.
- Responsive rules collapse the sidebars before shrinking the message canvas.

The app bootstrap configures PrimeUI from `PRIMEUI_LICENSE` or the ignored
`.env.local` file. The generated TypeScript config and the local licence both stay
out of Git; builds without a key still compile but PrimeUI displays its licence
notice.
See the [PrimeNG configuration guide](https://primeng.dev/configuration).

## Repository visibility

This repository is proprietary and private. The open-source runtime, CLI and
messaging-platform API emulators live in
[`chatwright/cli`](https://github.com/chatwright/cli) under Apache-2.0. Public
product specifications remain in
[`chatwright/chatwright`](https://github.com/chatwright/chatwright).
