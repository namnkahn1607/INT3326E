import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import type { BusinessUser } from './entities/user.entity';
import { USER_DATABASE } from './user-database.provider';

@Injectable()
export class UsersRepository implements OnModuleDestroy {
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async findByFirebaseUid(uid: string): Promise<BusinessUser[]> {
    if (!this.pool) throw new ServiceUnavailableException('User database is not configured');
    try {
      const result = await this.pool.query<BusinessUser>(
        'SELECT id, "firebaseUid", role FROM users WHERE "firebaseUid" = $1 LIMIT 2', [uid],
      );
      return result.rows;
    } catch {
      throw new ServiceUnavailableException('User database temporarily unavailable');
    }
  }

  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }
}
