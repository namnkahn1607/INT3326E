import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { firebaseAuthProvider } from './firebase-auth.provider';

const sdk = vi.hoisted(() => ({
  applicationDefault: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  applicationDefault: sdk.applicationDefault,
  getApp: sdk.getApp,
  getApps: sdk.getApps,
  initializeApp: sdk.initializeApp,
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: sdk.getAuth }));

describe('Firebase auth provider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    sdk.getApps.mockReturnValue([]);
    sdk.applicationDefault.mockReturnValue('adc');
    sdk.initializeApp.mockReturnValue('new-app');
    sdk.getAuth.mockReturnValue('firebase-auth');
  });

  afterEach(() => vi.unstubAllEnvs());

  function createAuth() {
    if (!('useFactory' in firebaseAuthProvider)) throw new Error('Expected factory provider');
    return firebaseAuthProvider.useFactory();
  }

  it('initializes the default app using application default credentials', () => {
    expect(createAuth()).toBe('firebase-auth');
    expect(sdk.initializeApp).toHaveBeenCalledWith({ credential: 'adc' });
    expect(sdk.getAuth).toHaveBeenCalledWith('new-app');
  });

  it('uses the explicitly configured Firebase project', () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'int3326e');
    createAuth();
    expect(sdk.initializeApp).toHaveBeenCalledWith({ credential: 'adc', projectId: 'int3326e' });
  });

  it('reuses an existing default app without reinitializing credentials', () => {
    sdk.getApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    sdk.getApp.mockReturnValue('existing-app');
    createAuth();
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(sdk.applicationDefault).not.toHaveBeenCalled();
    expect(sdk.getAuth).toHaveBeenCalledWith('existing-app');
  });

  it('creates a default app when only named apps exist', () => {
    sdk.getApps.mockReturnValue([{ name: 'other-project' }]);
    createAuth();
    expect(sdk.initializeApp).toHaveBeenCalledOnce();
    expect(sdk.getApp).not.toHaveBeenCalled();
  });
});
