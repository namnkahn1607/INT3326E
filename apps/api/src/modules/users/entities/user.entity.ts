import type { UserRole } from '../../auth/enums/user-role.enum';

export interface BusinessUser {
  id: string;
  firebaseUid: string;
  role: UserRole;
}
