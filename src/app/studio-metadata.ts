/** Shared by static HTML generation and Angular navigation. No user data enters metadata. */
export interface StudioMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: string;
}

export function studioMetadata(route: string): StudioMetadata {
  const path = route.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '');
  const canonical = `https://chatwright.dev/studio/${path || 'playground'}`;
  switch (path) {
    case '':
    case 'playground':
      return {
        title: 'Telegram Bot Playground | Chatwright',
        description: 'Explore a live sample bot in your browser. Try Telegram messages, inline buttons and edits in the Chatwright playground.',
        canonical,
        robots: 'index,follow'
      };
    case 'player':
      return {
        title: 'Bot Conversation Replay Player | Chatwright',
        description: 'Open a Chatwright run bundle and replay bot conversations in your browser. Inspect recorded messages and actions without uploading your file.',
        canonical,
        robots: 'index,follow'
      };
    case 'recordings':
      return {
        title: 'My Recordings | Chatwright Studio',
        description: 'Manage your saved Chatwright conversation recordings.',
        canonical,
        robots: 'noindex,follow'
      };
    default:
      return {
        title: 'Design Prototype | Chatwright Studio',
        description: 'Explore Chatwright Studio design prototypes with static sample data.',
        canonical,
        robots: 'noindex,follow'
      };
  }
}
