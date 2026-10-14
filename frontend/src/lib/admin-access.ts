export const isAdminPathAllowed = (allowedPaths: string[], pathname: string) =>
  pathname === '/admin/profile' || allowedPaths.some(
    (path) => pathname === path || (path !== '/admin' && pathname.startsWith(`${path}/`)),
  );

const ROLE_DASHBOARD: Record<string, string> = {
  ADMIN: '/admin',
  MARKETING: '/admin',
  CEO: '/admin',
};

export function getSafeAdminFallback(role: string | undefined, allowedPaths: string[]): string | null {
  const preferred = role ? ROLE_DASHBOARD[role] : undefined;
  if (preferred && isAdminPathAllowed(allowedPaths, preferred)) return preferred;
  return allowedPaths.find(path => path.startsWith('/admin')) || null;
}
