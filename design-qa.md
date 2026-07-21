# Landing page design QA

## Visual truth and evidence

- Selected direction: `/Users/alex/.codex/generated_images/019f85bc-23b4-72a1-9ff7-cd0214a633b0/exec-a7c93ec0-a04d-46a5-b3ea-e6e60735edc5.png`
- Implementation: `/private/tmp/chatwright-landing-implementation-v2.png` (1280 px desktop capture)
- Side-by-side comparison: `/private/tmp/chatwright-landing-qa-comparison-v2.png`

## Review

The implemented hero keeps the selected direction's important relationship: concise product and CLI evidence at left, a tall dark client emulator at right. The root page is explicitly light; the interactive Studio supplies the controlled dark contrast. Typography, whitespace, low-saturation blue/mint accents, and the lightweight developer-documentation treatment match the intended Linear-meets-Astro direction without copying either product.

- **Hierarchy and spacing:** the headline, local command, actions, and live browser are all visible in the opening composition. The explanatory evidence section follows with generous breathing room.
- **Colour and contrast:** all primary landing surfaces remain light. Mint is reserved for primary actions and status; blue is used for technical labels. The emulator is dark by design so it reads as a product surface rather than a decorative screenshot.
- **Product representation:** the hero contains the real Studio iframe, not fabricated artwork. Its address bar is an accessible link to `/studio/`, opening the Studio in a new tab.
- **Copy:** “Works offline” is present in the primary proof line, alongside the open-source CLI and platform emulators.
- **Positioning:** the hero explicitly identifies Chatwright as a local-first chat-platform emulator and distinguishes it from automation of an end user's Telegram or WhatsApp client. “Works offline” is the emphasized proof badge.
- **Live proof annotation:** “not a marketing screenshot” receives one restrained hand-drawn red underline generated as a transparent image asset; it is deliberately limited to that claim.
- **Responsive behaviour:** the two-column hero collapses cleanly to one column at 960 px; navigation and iframe dimensions have dedicated mobile rules.
- **Known intentional difference (P3):** the reference uses an isolated concept mock; this version uses the actual interactive emulator, therefore showing genuine Studio chrome and content. That is a deliberate usability gain for the requested live demo.

## Interaction and runtime checks

- Root landing loads locally at `http://localhost:8788/`.
- The hero address bar has one link with href `/studio/`.
- The production worker dry run and Angular typecheck pass.
- Browser diagnostics contain two `MutationObserver` exceptions emitted by the browser automation surface while it attaches to the live iframe; no visible landing or Studio failure results. There are no app-originated user-flow blockers.

final result: passed
