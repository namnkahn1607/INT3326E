import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';

import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TOKEN_VERIFIER } from './interfaces/token-verifier.interface';
import { firebaseAuthProvider } from './providers/firebase-auth.provider';
import { FirebaseTokenVerifierService } from './services/firebase-token-verifier.service';

@Module({
  controllers: [AuthController],
  providers: [
    firebaseAuthProvider,
    FirebaseTokenVerifierService,
    {
      provide: TOKEN_VERIFIER,
      useExisting: FirebaseTokenVerifierService,
    },
    FirebaseAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: FirebaseAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [
    TOKEN_VERIFIER,
    FirebaseAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
