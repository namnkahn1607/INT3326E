import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { logDependencyFailure } from '../../common/dependency-diagnostics';

export const USER_DATABASE = Symbol('USER_DATABASE');

export const userDatabaseProvider = {
  provide: USER_DATABASE,
  useFactory: (): Pool | null => {
    if (!process.env.DATABASE_URL) return null;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000,
    });
    pool.on('error', error => logDependencyFailure(new Logger('UserDatabase'), 'database.idle', error));
    return pool;
  },
};
