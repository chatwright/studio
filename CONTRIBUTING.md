# Contributing to Chatwright Studio

Thank you for interest in contributing to Chatwright Studio. This repository
hosts the Angular Studio application and the chatwright.dev landing page worker.

## Build and run

```bash
pnpm install
cp .env.example .env.local
pnpm start
```

Open http://localhost:4200. The `PRIMEUI_LICENSE` environment variable is
optional — builds compile without it, though PrimeUI will display its licence notice.

Production build:

```bash
pnpm build
```

## DCO sign-off

By contributing, you certify that your contribution was created in whole or in
part by you and you have the right to submit it under the project's Apache 2.0
license. We use the [Developer Certificate of Origin
(DCO)](https://developercertificate.org/).

Sign off your commits with `git commit -s` or add a line to your commit
message:

```
Signed-off-by: Your Name <your@email.com>
```

## Scope of this repository

This repository covers **Studio and landing implementation** — build,
styling, routing, UI state, and deployment of the chatwright.dev application.

**Product and specification discussion** — features, roadmap, scenarios, API
contracts, and design decisions about the Chatwright platform — belong in the
main [`chatwright/chatwright`](https://github.com/chatwright/chatwright)
repository, where the runtime, CLI, and scenario specifications live. Refer to
that repository's issues and discussions for product work; use this repository
for Studio-specific bugs and implementation PRs.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of
Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this
code. For reporting unacceptable behaviour, see the Code of Conduct's
Enforcement section.
