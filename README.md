# Chatwright Studio

Open-source visual development environment for Chatwright, licensed under
[Apache-2.0](LICENSE). The current application is a connected zoneless Angular
22 + PrimeNG 22 prototype built with Angular Signals and static sample data.

The long-term product connects to an authenticated Chatwright CLI server on the
local machine. That local-first bridge lets a developer move from terminal output
to the visual Studio without uploading private run data. Supported local
Playground, authoring, recording and inspection workflows continue working
offline and without a Chatwright or Sneat account. Cloud persistence, hosted
execution, sharing and managed intelligence remain explicit optional actions.

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

## Production site and Studio

The light-only landing page lives at [chatwright.dev](https://chatwright.dev/)
and embeds the Playground as an interactive product preview. The Studio is
mounted at [chatwright.dev/studio/](https://chatwright.dev/studio/), where Angular
builds with `/studio/` as its base href. `chatwright-dev` owns the domain as a
Cloudflare Custom Domain; the former `/prototype/` path remains as a redirect for
existing links.

```bash
pnpm deploy:dry-run
pnpm deploy:cloudflare
```

Pushes to `main` call the shared
[`sneat-co/cicd` Cloudflare workflow](https://github.com/sneat-co/cicd/blob/main/.github/workflows/cf-deploy.yml).
The repository needs `CLOUDFLARE_API_TOKEN` and `PRIMEUI_LICENSE` secrets plus a
`CLOUDFLARE_ACCOUNT_ID` Actions variable.

The hosted web build is a deployment of the same Apache-2.0 Studio. Proprietary
commercial value belongs to the separate operated Chatwright Cloud service—not
to an account gate or closed local Studio.

## Connected mock-ups

| View | Route | Primary question |
|---|---|---|
| Workspace | `/workspace` | Can users understand hierarchy, coverage and the next useful action? |
| Playground (default) | `/emulator` | Can several actor/chat contexts stay legible while all actions use one run? |
| Scenario | `/scenario` | Can conversational intent and executable assertions read as one specification? |
| Run inspector | `/run` | Can a failure or edit be explained from transcript, trace and metrics without a debugger? |

All views refer to the same workspace, `greetbot/language-choice` scenario and
`run-1842`. Links between them preserve that mental context.

## Dynamic interaction

In the Playground, select one of the four Telegram inline language actions. The
reply text changes in place, its version increments, an “edited” marker appears,
and a matching `editMessageText` event is added to the trace rail. User messages
can also be sent through the composer. Hover a trace event for formatted JSON or
click it to open the correlated full inspector; message events open directly in
the rendered representation tab. Reset returns the run to the English v1 state.

The Playground mock is a consumer of a Telegram Platform Emulator. In this
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
`.env.local` file. The generated TypeScript config and any local third-party
licence key stay out of Git; builds without a key still compile but PrimeUI
displays its licence notice. This third-party configuration does not change
Chatwright Studio's Apache-2.0 licence.
See the [PrimeNG configuration guide](https://primeng.dev/configuration).

## Licence and product boundary

Chatwright Studio is open source under the [Apache License 2.0](LICENSE), alongside
the Runtime, CLI, Platform Emulators and Playground. Everything required for
local development works without a cloud account. The open-source runtime, CLI
and product specifications live together in
[`chatwright/chatwright`](https://github.com/chatwright/chatwright) (Go module
`github.com/chatwright/chatwright`, CLI via `cmd/chatwright`).

Chatwright Cloud may remain a closed commercial service. Its optional value is
managed execution, sync, retained reports, collaboration, organisations and AI
orchestration at scale. Connecting or disconnecting Cloud must not make local
Studio projects unusable.
