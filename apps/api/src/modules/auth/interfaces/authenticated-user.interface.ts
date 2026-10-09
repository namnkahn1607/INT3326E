import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: UserRole;
}