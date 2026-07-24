import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The entire `firebase/app` + `firebase/auth` SDK is mocked so this suite
 * never touches real network/IndexedDB (unavailable in Vitest's plain Node
 * environment anyway — see vitest.config.ts) — only `AuthService`'s own
 * orchestration is under test. `authState`/mocks are declared via
 * `vi.hoisted` because `vi.mock` factories are hoisted above this file's
 * imports, so a plain `let` here would be read before initialisation.
 */
const authState = vi.hoisted(() => ({
  callback: null as ((user: unknown) => void) | null,
  currentUser: null as { getIdToken: () => Promise<string> } | null
}));
const signInWithPopupMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({}))
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return authState.currentUser;
    }
  })),
  onAuthStateChanged: vi.fn((_auth: unknown, next: (user: unknown) => void) => {
    authState.callback = next;
    return () => {};
  }),
  signInWithPopup: signInWithPopupMock,
  signOut: signOutMock,
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({}))
}));

import { AuthService, friendlyAuthError, initialsOf, toSneatAccount } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    authState.callback = null;
    authState.currentUser = null;
    signInWithPopupMock.mockReset();
    signOutMock.mockReset();
  });

  it('starts initializing/signed-out and resolves once onAuthStateChanged fires', () => {
    const service = new AuthService();
    expect(service.initializing()).toBe(true);
    expect(service.signedIn()).toBe(false);
    expect(service.account()).toBeNull();

    authState.callback?.({ uid: 'u1', displayName: 'Alex Trakhimenok', email: 'alex@sneat.app', photoURL: null });

    expect(service.initializing()).toBe(false);
    expect(service.signedIn()).toBe(true);
    expect(service.account()).toEqual({
      uid: 'u1',
      displayName: 'Alex Trakhimenok',
      email: 'alex@sneat.app',
      photoURL: null,
      initials: 'AT'
    });
  });

  it('a null user (signed out) clears the account and stops initializing', () => {
    const service = new AuthService();
    authState.callback?.({ uid: 'u1', displayName: 'Alex', email: null, photoURL: null });
    expect(service.signedIn()).toBe(true);

    authState.callback?.(null);
    expect(service.signedIn()).toBe(false);
    expect(service.account()).toBeNull();
  });

  it('signIn() opens the Google popup and toggles signingIn around it', async () => {
    signInWithPopupMock.mockResolvedValue(undefined);
    const service = new AuthService();

    const pending = service.signIn();
    expect(service.signingIn()).toBe(true);
    await pending;

    expect(service.signingIn()).toBe(false);
    expect(service.error()).toBeNull();
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });

  it('signIn() records a friendly error and still clears signingIn on failure', async () => {
    signInWithPopupMock.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const service = new AuthService();

    await service.signIn();

    expect(service.signingIn()).toBe(false);
    expect(service.error()).toBe('Sign-in was cancelled.');
  });

  it('signOut() delegates to firebase/auth signOut', async () => {
    signOutMock.mockResolvedValue(undefined);
    const service = new AuthService();

    await service.signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('getIdToken() is null with no current user', async () => {
    const service = new AuthService();
    await expect(service.getIdToken()).resolves.toBeNull();
  });

  it('getIdToken() returns the current user\'s Firebase ID token', async () => {
    authState.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token-xyz') };
    const service = new AuthService();
    await expect(service.getIdToken()).resolves.toBe('id-token-xyz');
  });

  it('getIdToken() swallows a token-fetch failure as null rather than throwing', async () => {
    authState.currentUser = { getIdToken: vi.fn().mockRejectedValue(new Error('boom')) };
    const service = new AuthService();
    await expect(service.getIdToken()).resolves.toBeNull();
  });
});

describe('toSneatAccount', () => {
  it('maps a Firebase User to the fields this app renders, with computed initials', () => {
    const account = toSneatAccount({
      uid: 'u1',
      displayName: 'Alex Trakhimenok',
      email: 'alex@sneat.app',
      photoURL: 'https://example.com/a.png'
    } as never);
    expect(account).toEqual({
      uid: 'u1',
      displayName: 'Alex Trakhimenok',
      email: 'alex@sneat.app',
      photoURL: 'https://example.com/a.png',
      initials: 'AT'
    });
  });

  it('falls back to email when displayName is blank', () => {
    const account = toSneatAccount({ uid: 'u1', displayName: '  ', email: 'alex@sneat.app', photoURL: null } as never);
    expect(account?.displayName).toBe('alex@sneat.app');
  });

  it('returns null for a null user', () => {
    expect(toSneatAccount(null)).toBeNull();
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first and last word for a full name', () => {
    expect(initialsOf('Alex Trakhimenok')).toBe('AT');
  });
  it('takes the first two letters of a single word', () => {
    expect(initialsOf('alex@sneat.app')).toBe('AL');
  });
  it('falls back to "?" for blank input', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('friendlyAuthError', () => {
  it('maps known Firebase Auth error codes to short human copy', () => {
    expect(friendlyAuthError({ code: 'auth/popup-blocked' })).toMatch(/blocked the sign-in popup/);
    expect(friendlyAuthError({ code: 'auth/network-request-failed' })).toMatch(/network/i);
    expect(friendlyAuthError({ code: 'auth/unauthorized-domain' })).toMatch(/not yet authorized/);
  });

  it('falls back to the Error message for an unrecognised error', () => {
    expect(friendlyAuthError(new Error('custom failure'))).toBe('custom failure');
  });

  it('falls back to a generic message for a non-Error, non-coded throw', () => {
    expect(friendlyAuthError('nope')).toBe('Sign-in failed — please try again.');
  });
});
