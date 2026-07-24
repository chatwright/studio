import { FirebaseOptions } from 'firebase/app';

/**
 * The Sneat platform's public Firebase Web config (project `sneat-eur3-1`) —
 * Chatwright Cloud's "sign in with a Sneat account" reuses this SAME
 * project/app rather than standing up a Chatwright-specific one, so a
 * Chatwright sign-in is a Sneat sign-in (one identity across the ecosystem).
 * Values copied verbatim from sneat-apps'
 * `apps/sneat-app/src/environments/environment.ts` (`sneatAppEnvironmentConfig
 * .firebaseConfig`) — a Firebase Web config's `apiKey` etc. are public
 * client identifiers, not secrets (Firebase's own security boundary is
 * Authentication's Authorized domains + Firestore/Storage security rules,
 * not hiding this object), so committing it here is the same posture every
 * other Sneat app already ships.
 *
 * `authDomain` deliberately does NOT copy sneat-app's `'sneat.app'` value.
 * sneat-apps' own migration notes (`docs/superpowers/plans/2026-07-06-sneat-
 * app-cloudflare-landing.md`, "Root-mounting the app on a CF Worker breaks
 * Google OAuth redirect sign-in unless the Firebase auth handler is served
 * natively") record that a Cloudflare-Worker-hosted app must pin `authDomain`
 * to the project's own Firebase Hosting domain
 * (`sneat-eur3-1.firebaseapp.com`), which serves `/__/auth/handler` out of
 * the box — `chatwright.dev` is exactly this same shape (CF Worker root-
 * mount, see wrangler.jsonc), so it inherits that fix rather than
 * rediscovering it. See this file's sibling `auth.service.ts` doc comment
 * for the sign-in flow this enables.
 *
 * ⚠️ For `signInWithPopup` to succeed at all, `chatwright.dev` (and
 * `localhost` for local dev — Firebase allows `localhost` by default) must
 * be listed in the `sneat-eur3-1` Firebase project's Authentication →
 * Settings → **Authorized domains**. That is a Firebase-console change this
 * PR cannot make (no console credentials in this environment) — flagged in
 * the PR body and in chatwright/backstage/TODO-for-humans.md as a founder
 * action item.
 */
export const SNEAT_FIREBASE_CONFIG: FirebaseOptions = {
  projectId: 'sneat-eur3-1',
  appId: '1:588648831063:web:303af7e0c5f8a7b10d6b12',
  apiKey: 'AIzaSyCeQu1WC182yD0VHrRm4nHUxVf27fY-MLQ',
  authDomain: 'sneat-eur3-1.firebaseapp.com',
  messagingSenderId: '588648831063'
};
