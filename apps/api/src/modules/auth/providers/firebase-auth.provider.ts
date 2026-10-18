import type { Provider } from '@nestjs/common';
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { validateFirebaseEnvironment } from '../../../config/env.validation';

export const FIREBASE_AUTH = Symbol('FIREBASE_AUTH');

export function createFirebaseAuth() {
  validateFirebaseEnvironment(process.env);
  const existingDefault = getApps().some((candidate) => candidate.name === '[DEFAULT]');
  const app = existingDefault
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        ...(process.env.FIREBASE_PROJECT_ID
          ? { projectId: process.env.FIREBASE_PROJECT_ID }
          : {}),
      });

  if (existingDefault && process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PROJECT_ID !== app.options.projectId) {
    throw new Error('Existing Firebase app belongs to another project');
  }
  return getAuth(app);
}

export const firebaseAuthProvider: Provider = {
  provide: FIREBASE_AUTH,
  useFactory: createFirebaseAuth,
};
