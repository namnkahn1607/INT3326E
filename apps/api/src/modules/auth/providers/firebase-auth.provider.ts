import type { Provider } from '@nestjs/common';
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const FIREBASE_AUTH = Symbol('FIREBASE_AUTH');

export const firebaseAuthProvider: Provider = {
  provide: FIREBASE_AUTH,
  useFactory: () => {
    const app = getApps().some((candidate) => candidate.name === '[DEFAULT]')
      ? getApp()
      : initializeApp({
          credential: applicationDefault(),
          ...(process.env.FIREBASE_PROJECT_ID
            ? { projectId: process.env.FIREBASE_PROJECT_ID }
            : {}),
        });

    return getAuth(app);
  },
};
