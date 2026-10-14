'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

export function hasPermission(granted: Iterable<string>, permission: string): boolean {
  const permissions = granted instanceof Set ? granted : new Set(granted);
  return permissions.has('*') || permissions.has(permission);
}

export function usePermissions() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const can = useCallback((permission: string) => hasPermission(permissions, permission), [permissions]);
  const canAny = useCallback((...required: string[]) => required.some(permission => hasPermission(permissions, permission)), [permissions]);
  const canAll = useCallback((...required: string[]) => required.every(permission => hasPermission(permissions, permission)), [permissions]);
  return { permissions, can, canAny, canAll };
}