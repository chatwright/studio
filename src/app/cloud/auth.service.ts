import { Injectable, computed, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';

import { SNEAT_FIREBASE_CONFIG } from './firebase.config';

/** The handful of a Firebase `User` this app actually renders — see `toSneatAccount`. */
export interface SneatAccount {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  /** 1-2 letter fallback for `<p-avatar>` when there is no `photoURL` — see `initialsOf`. */
  initials: string;
}

/**
 * "Sign in with a Sneat account" over the plain `firebase/auth` SDK, reusing
 * the SAME Firebase project every other Sneat app signs into (`sneat-eur3-1`,
 * with the same `authDomain` — `'sneat.app'` — every shipped Sneat app uses;
 * see `firebase.config.ts`'s doc comment) rather than standing up a
 * Chatwright-specific identity. Google is the only provider wired today
 * (`signIn()`); the SDK supports adding more later without touching this
 * service's public surface.
 *
 * `account`/`initializing`/`signingIn`/`error` are plain signals — every
 * consumer (the sidebar block, the Player's "Save to my space" action, the
 * My recordings page) reads them directly rather than this service exposing
 * an Observable, matching this codebase's existing signal-first services
 * (`PlayerEngine`, `DemoStore`).
 *
 * Firebase itself is lazily initialised on first use (`ensureAuth`), not at
 * module load — this service still eagerly subscribes to
 * `onAuthStateChanged` in its constructor (Angular constructs it once, on
 * first injection, via `providedIn: 'root'`) so `account`/`initializing`
 * reflect a real session (including one restored from IndexedDB) as soon as
 * anything asks.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;

  /** `null` while signed out; the Sneat account once Firebase resolves one. */
  readonly account = signal<SneatAccount | null>(null);
  /** True until the first `onAuthStateChanged` callback fires — lets a consumer avoid flashing a "Sign in" button before a restored session is known. */
  readonly initializing = signal(true);
  /** True only while a `signIn()` popup is in flight. */
  readonly signingIn = signal(false);
  /** The last sign-in/sign-out error, human-readable; `null` once cleared by the next attempt. */
  readonly error = signal<string | null>(null);
  readonly signedIn = computed(() => this.account() !== null);

  constructor() {
    const auth = this.ensureAuth();
    onAuthStateChanged(
      auth,
      (user) => {
        this.account.set(toSneatAccount(user));
        this.initializing.set(false);
      },
      (error) => {
        this.error.set(friendlyAuthError(error));
        this.initializing.set(false);
      }
    );
  }

  /** Opens the Google sign-in popup. Resolves once signed in OR once the attempt fails/is cancelled — check `error()` afterwards. */
  async signIn(): Promise<void> {
    this.error.set(null);
    this.signingIn.set(true);
    try {
      await signInWithPopup(this.ensureAuth(), new GoogleAuthProvider());
    } catch (error) {
      this.error.set(friendlyAuthError(error));
    } finally {
      this.signingIn.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.ensureAuth());
    } catch (error) {
      this.error.set(friendlyAuthError(error));
    }
  }

  /**
   * The current Firebase ID token, for the `Authorization: Bearer <token>`
   * header sneat-go's `identityAdapter` expects (see
   * `pkg/modules/chatwright/adapters.go`). `null` when signed out or the
   * token fetch itself fails — callers (see `RecordingsService`) treat
   * either the same way: "sign in required".
   */
  async getIdToken(): Promise<string | null> {
    const user = this.ensureAuth().currentUser;
    if (!user) {
      return null;
    }
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }

  private ensureAuth(): Auth {
    if (!this.auth) {
      this.app = initializeApp(SNEAT_FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
    }
    return this.auth;
  }
}

/** Pure projection of a Firebase `User` onto the fields this app renders — kept free of the `AuthService` class so it is trivially unit-testable. */
export function toSneatAccount(user: User | null): SneatAccount | null {
  if (!user) {
    return null;
  }
  const displayName = user.displayName?.trim() || user.email || 'Sneat account';
  return {
    uid: user.uid,
    displayName,
    email: user.email,
    photoURL: user.photoURL,
    initials: initialsOf(displayName)
  };
}

/** `"Alex Trakhimenok"` → `"AT"`; a single-word name → its first two letters; empty/whitespace → `"?"`. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Maps a Firebase Auth error (or anything else thrown) to a short, human-readable message — never a raw `error.code` or stack trace. */
export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup — allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error during sign-in — check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized for sign-in.';
    default:
      return error instanceof Error ? error.message : 'Sign-in failed — please try again.';
  }
}
