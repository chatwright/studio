/**
 * Registry of bundled demo run bundles the /player page offers under "Load
 * sample". Each entry names a file in `public/samples/`.
 *
 * TO ADD A SAMPLE: drop the `*.chatwright.json` file into `public/samples/` and
 * add one entry to this array — nothing else. The page resolves the file
 * relative to the app base href, so it works under both `/` (dev) and `/studio/`
 * (production).
 */
export interface BundledSample {
  /** File name in public/samples/. */
  file: string;
  title: string;
  description: string;
}

export const BUNDLED_SAMPLES: BundledSample[] = [
  {
    file: 'greetbot-language.chatwright.json',
    title: 'Greetbot — language onboarding',
    description:
      'A single AI-goal run: the actor greets, the bot offers a language keyboard, and the reply is edited in place.'
  }
  // A 3-part run and a 2-chat run are dropped in after round 2 — add their
  // files to public/samples/ and one entry each here.
];
