import { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}