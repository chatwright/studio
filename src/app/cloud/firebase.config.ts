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
 * `authDomain` is `'sneat.app'` — the same value every shipped Sneat app
 * uses (see assetus' `frontend/apps/assetus-app/src/environments
 * /environment.ts` and sneat-apps commit `5e012f81c`), NOT the project's raw
 * `sneat-eur3-1.firebaseapp.com` Firebase Hosting domain. The `*.firebaseapp
 * .com` domain only serves `/__/auth/handler`; it 404s on
 * `/__/firebase/init.json`, which the Firebase Auth SDK's popup handler
 * fetches to finalize `signInWithPopup` — pointing `authDomain` there breaks
 * sign-in outright. `sneat.app` serves both, matching every other Sneat app
 * (including CF-Worker-root-mounted ones), so Chatwright Cloud inherits the
 * same working configuration rather than the superseded plan this file
 * previously cited. See this file's sibling `auth.service.ts` doc comment
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
  authDomain: 'sneat.app',
  messagingSenderId: '588648831063'
};
