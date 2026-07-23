// Hand-embedded snapshot of chatwright/recipes content for the /recipes page
// (see ./page.ts and ../index.ts). This is NOT generated: every value below
// was read directly out of chatwright/recipes' jobs/*.md front matter,
// recipes/*/README.md front matter, recipes/*/implementations/*.md front
// matter, recipes/*/snippets/*.md front matter and registry/registry.json,
// then copied in by hand. There is no build step, CI job or fetch that keeps
// this file in sync with upstream — an automated content pipeline (fetch +
// validate + regenerate this file from the source repo) is tracked as
// research item I-72. Until that lands, this file silently drifts whenever
// chatwright/recipes changes; a human has to notice and re-sync it.
// recipesSourceCommit records exactly which upstream commit this hand-sync
// reflects, so drift is at least detectable — see the page footer.

/** Short SHA of chatwright/recipes@main this snapshot was hand-synced from. */
export const recipesSourceCommit = '3fdc32d';

export type ImplementationTier = 'official' | 'alternative' | 'community';

export interface RecipeImplementation {
  readonly title: string;
  readonly tier: ImplementationTier;
  readonly platform: string;
}

export interface RecipeSnippet {
  readonly label: string;
}

export interface Recipe {
  readonly id: string;
  readonly title: string;
  /** Job ids this Recipe solves — cross-references Job.id below. */
  readonly jobIds: readonly string[];
  readonly status: string;
  readonly watch?: string; // player URL of a real recorded run bundle
  readonly tags: readonly string[];
  readonly implementations: readonly RecipeImplementation[];
  /** Framework snippets under recipes/<id>/snippets/ — empty when none exist yet. */
  readonly snippets: readonly RecipeSnippet[];
  /** chatwright/recipes URL for this Recipe's README.md. */
  readonly githubUrl: string;
}

export interface Job {
  readonly id: string;
  readonly title: string;
  /** Recipe ids that solve this Job — empty means "recipe wanted". */
  readonly solvedBy: readonly string[];
}

export interface RegistryEntry {
  readonly id: string;
  readonly repo: string;
  readonly specFirst: boolean;
}

// jobs/*.md, front matter: id, title, solvedBy.
export const jobs: readonly Job[] = [
  {
    id: 'collect-rsvp-for-event',
    title: 'Collect RSVP for an event',
    solvedBy: ['collect-rsvp']
  },
  {
    id: 'onboard-users-in-their-language',
    title: 'Onboard users in their language',
    solvedBy: ['language-onboarding']
  },
  {
    id: 'send-a-debt-receipt',
    title: 'Send a debt receipt',
    solvedBy: []
  },
  {
    id: 'split-a-restaurant-bill',
    title: 'Split a restaurant bill',
    solvedBy: []
  }
];

// recipes/*/README.md front matter (id, title, jobs, status, tags) plus each
// recipe's implementations/*.md front matter (title, tier, platform) and
// snippets/*.md front matter (label).
export const recipes: readonly Recipe[] = [
  {
    id: 'collect-rsvp',
    title: 'Collect RSVP for an event',
    jobIds: ['collect-rsvp-for-event'],
    status: 'draft',
    tags: ['rsvp', 'events', 'buttons'],
    implementations: [
      { title: 'Telegram inline buttons', tier: 'official', platform: 'Telegram' },
      { title: 'Universal numbered replies', tier: 'alternative', platform: 'any' },
      { title: 'AI conversation', tier: 'alternative', platform: 'any' }
    ],
    snippets: [],
    githubUrl: 'https://github.com/chatwright/recipes/blob/main/recipes/collect-rsvp/README.md'
  },
  {
    id: 'language-onboarding',
    watch: '/studio/player?embed=1&autoplay=1&sample=greetbot-two-part.chatwright.json',
    title: 'Language onboarding',
    jobIds: ['onboard-users-in-their-language'],
    status: 'draft',
    tags: ['start', 'onboarding', 'i18n'],
    implementations: [{ title: 'Inline buttons + message edit', tier: 'official', platform: 'Telegram' }],
    snippets: [{ label: 'Vanilla JS' }, { label: 'bots-fw (Go)' }, { label: 'Python (python-telegram-bot)' }],
    githubUrl: 'https://github.com/chatwright/recipes/blob/main/recipes/language-onboarding/README.md'
  }
];

// registry/registry.json — the federation registry of independently owned
// CHATWRIGHT.md repositories. greetbot carries specFirst: true.
export const registryEntries: readonly RegistryEntry[] = [
  {
    id: 'greetbot',
    repo: 'https://github.com/chatwright/greetbot',
    specFirst: true
  }
];
