// Studio (Angular) routes that must answer 200 with the app shell on a hard
// load or deep link. `_redirects` rewrites cannot express "only when no file
// matches" (a rewrite wins over an existing asset), so the SPA fallback is
// an explicit list rather than `/studio/*`. src/app/studio-deep-links.spec.ts
// fails when app.routes.ts gains a path that is missing here.
export const studioDeepLinks: readonly string[] = [
  'playground',
  'player',
  'recordings',
  'prototypes/workspace',
  'prototypes/emulator',
  'prototypes/scenario',
  'prototypes/run',
  'workspace',
  'emulator',
  'scenario',
  'run'
];
