# Chatwright Studio — instructions for AI agents and humans

The Chatwright **development principles and working conventions** are canonical
in the main repository:
https://github.com/chatwright/chatwright/blob/main/AGENTS.md — read and follow
them here too.

Studio-specific notes:

- Build/run: `pnpm install`, `pnpm start`, `pnpm build` (PRIMEUI_LICENSE
  optional — builds compile without it). See [CONTRIBUTING.md](CONTRIBUTING.md).
- The landing page (`worker/landing.ts`) is a live public surface: every claim
  on it must be true today or explicitly labelled as planned ("fidelity is
  declared" applies to marketing too).
- Product/spec discussion belongs in github.com/chatwright/chatwright; this
  repo takes Studio and landing implementation changes.
- Pushes to `main` deploy to chatwright.dev.
