import { loadEnvFile } from 'node:process';

import { validateEnvironment } from '../config/env.validation';
import { UserRole } from '../modules/auth/enums/user-role.enum';
import { createFirebaseAuth } from '../modules/auth/providers/firebase-auth.provider';
import { RoleClaimsService, type ExpectedRole } from '../modules/auth/services/role-claims.service';

export function readRoleOptions(args: string[], env: NodeJS.ProcessEnv) {
  const values: Record<string, string> = {};
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--apply' && !apply) { apply = true; continue; }
    if (!['--project', '--uid', '--role', '--expect-role'].includes(key) ||
        values[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: --project ID --uid UID --role ROLE --expect-role ROLE_OR_NONE [--apply]');
    }
    values[key] = args[++i];
  }
  const project = values['--project'];
  if (!project || !/^[a-z][a-z0-9-]{4,62}$/.test(project) ||
      (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== project)) {
    throw new Error('--project must be explicit and match FIREBASE_PROJECT_ID when configured');
  }
  const role = values['--role'] as UserRole;
  const expectedRole = values['--expect-role'] as ExpectedRole;
  if (!values['--uid'] || !Object.values(UserRole).includes(role) ||
      ![...Object.values(UserRole), 'NONE'].includes(expectedRole)) {
    throw new Error('Explicit UID, supported role and --expect-role are required');
  }
  return { project, uid: values['--uid'], role, expectedRole, apply };
}

async function main() {
  try { loadEnvFile(); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const options = readRoleOptions(process.argv.slice(2), process.env);
  process.env.FIREBASE_PROJECT_ID = options.project;
  validateEnvironment(process.env);
  const service = new RoleClaimsService(createFirebaseAuth());
  console.log(JSON.stringify(await service.setRole(
    options.uid, options.role, options.expectedRole, options.apply,
  )));
}

if (require.main === module) void main().catch((error: unknown) => {
  // SDK error bodies can contain account details; only display our own validation messages.
  console.error(error instanceof Error && !('code' in error)
    ? error.message : 'Firebase role operation failed. Check project, credentials and account permissions.');
  process.exitCode = 1;
});
