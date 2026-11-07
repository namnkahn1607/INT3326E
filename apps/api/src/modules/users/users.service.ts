import { Inject, Injectable } from '@nestjs/common';
import { ApiProblem } from '../../common/api-problem';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { BusinessUser } from './entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  async requireBusinessUser(identity: AuthenticatedUser): Promise<BusinessUser> {
    const records = await this.users.findByFirebaseUid(identity.uid);
    const user = records[0];
    if (records.length !== 1 || !user || typeof user.id !== 'string' || !user.id.trim() ||
        user.firebaseUid !== identity.uid || user.role !== identity.role) {
      throw new ApiProblem(409, 'USER_NOT_PROVISIONED', 'Business user is not provisioned');
    }
    return { id: user.id, firebaseUid: user.firebaseUid, role: user.role };
  }
}
