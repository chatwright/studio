# Security policy

## Supported versions

Chatwright Studio has not tagged a release yet — the project is pre-release. Only the
`main` branch is supported with security fixes.

| Version | Supported |
|---------|-----------|
| `main`  | :white_check_mark: |
| Any tagged pre-1.0 release, once they exist | Best effort; upgrade to `main` recommended |

This table will be replaced with a normal supported-version range once
Chatwright starts tagging releases.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a suspected security
vulnerability.

Report it privately through **GitHub Security Advisories**: on this
repository, go to the **Security** tab → **Report a vulnerability**. This
opens a private draft advisory visible only to you and the maintainers, where
you can describe the issue, its impact, and steps to reproduce it.

We aim to acknowledge new reports promptly and to keep you updated as the
issue is investigated and fixed. Please give us reasonable time to address a
confirmed vulnerability before any public disclosure.

## Scope

This policy covers the Chatwright Studio user interface in this repository:

- The Angular 22 Studio application component and dependencies.
- The chatwright.dev landing page worker that hosts and serves the Studio.

It does not cover the separately operated **Chatwright Cloud** service or the
Chatwright runtime, CLI, and Platform Emulators — those are maintained in the
[main chatwright/chatwright repository](https://github.com/chatwright/chatwright).
If a report turns out to concern those components rather than this repository,
say so and we will route it appropriately.

## Areas of special interest

- Anything that compromises the security of the local-first development
  workflow or the bridge between local Studio and the CLI runtime.
- Client-side vulnerabilities in the Angular application that could affect
  developer workflows (e.g., sensitive data exposure, XSS).
- Issues with the Cloudflare Worker hosting the landing page and Studio,
  including routing or authentication concerns.
- Any way fixture data, recorded runs, or workspace state could be exposed
  beyond the developer's local machine without explicit action.

## Disclosure

We do not currently operate a bug-bounty programme. Credit will be given in
the advisory (and, where relevant, the release notes) to reporters who wish to
be named, once a fix is available.
