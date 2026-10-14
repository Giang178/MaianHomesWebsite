export type UserRole = 'ADMIN' | 'MARKETING';

export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_SETUP';

export interface AccountUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole | string;
  permissions: string[];
  status: AccountStatus | string;
  is_active: boolean;
  must_change_password: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface AccountCreatePayload {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  permissions?: string[];
}

export type AccountCreatedResponse = AccountUser;

export interface AccountUpdatePayload {
  full_name?: string;
  phone?: string;
  role?: UserRole;
  status?: AccountStatus;
  is_active?: boolean;
  permissions?: string[];
}

export interface PermissionCatalog {
  items: string[];
  dependencies: Record<string, string[]>;
  presets: Record<'ADMIN' | 'MARKETING', string[]>;
}
