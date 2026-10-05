import { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}