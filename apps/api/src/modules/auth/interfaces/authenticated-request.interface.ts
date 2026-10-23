import { AuthenticatedUser } from './authenticated-user.interface';
import type { BusinessUser } from '../../users/entities/user.entity';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
  businessUser?: BusinessUser;
}
