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
    file: 'greetbot-two-part.chatwright.json',
    title: 'Greetbot — two parts',
    description:
      'Deterministic onboarding (the bot offers a language keyboard, the reply is edited in place), then an AI-goal acknowledgement.'
  },
  {
    file: 'greetbot-three-part.chatwright.json',
    title: 'Greetbot — three parts',
    description:
      'Deterministic onboarding, then two AI-goal parts. Click the edited greeting to see it observed by both AI parts.'
  },
  {
    file: 'debt-two-chat.chatwright.json',
    title: 'Debt — two chats, three actors',
    description:
      'Alice records a debt; the bot notifies Bob in another chat; Bob acknowledges and the confirmation lands back with Alice. Watch the transcript auto-follow across chats.'
  }
];
