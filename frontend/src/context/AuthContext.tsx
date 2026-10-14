'use client';

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/features/auth/api';
import { SESSION_EXPIRED_EVENT } from '@/lib/api';

export type Role =
  | 'ADMIN'
  | 'MARKETING'
  | 'CEO';

interface User {
  id?: string;
  email: string;
  role: Role;
  name: string;
  phone?: string;
  avatar_url?: string;
  employee_id?: string;
  employee_code?: string;
  /** @deprecated Authentication uses the HttpOnly access_token cookie. */
  access_token?: string;
  allowed_paths?: string[];
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  /** @deprecated The access_token argument remains only for call-site compatibility. */
  login: (email: string, role: Role, name?: string, avatar_url?: string, employee_id?: string, employee_code?: string, access_token?: string, id?: string, phone?: string, allowed_paths?: string[], permissions?: string[]) => void;
  logout: () => void;
  updateAvatar: (avatar_url: string) => void;
  updateProfile: (profile: { name?: string; phone?: string; avatar_url?: string }) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function withoutAccessToken<T extends { access_token?: string }>(
  profile: T,
): Omit<T, 'access_token'> {
  const safeProfile = { ...profile };
  delete safeProfile.access_token;
  return safeProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const savedProfile = localStorage.getItem('maian_user');
    if (!savedProfile) {
      setIsLoading(false);
      return;
    }

    let parsedProfile: User | null = null;
    try {
      parsedProfile = JSON.parse(savedProfile);
      if (parsedProfile) {
        parsedProfile = withoutAccessToken(parsedProfile);
        if (isMounted) setUser(parsedProfile);
      }
    } catch {
      localStorage.removeItem('maian_user');
      if (isMounted) setIsLoading(false);
      return;
    }

    authApi.verify()
      .then((res) => {
        if (!isMounted) return;
        if (res.user) {
          const verifiedUser: User = {
            id: res.user.id || res.user.account_id || res.user.employee_id,
            role: res.user.role,
            email: res.user.email,
            name: res.user.name || res.user.email.split('@')[0].toUpperCase(),
            phone: res.user.phone,
            employee_id: res.user.employee_id,
            employee_code: res.user.employee_code,
            avatar_url: res.user.avatar_url || parsedProfile?.avatar_url,
            allowed_paths: res.user.allowed_paths || parsedProfile?.allowed_paths || [],
            permissions: res.user.permissions || parsedProfile?.permissions || [],
          };
          setUser(verifiedUser);
          localStorage.setItem('maian_user', JSON.stringify(verifiedUser));
          if (typeof document !== 'undefined') {
            document.cookie = 'maian_logged_in=1; path=/; max-age=86400; SameSite=Lax';
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Session verification failed (cookie expired):', err);
        setUser(null);
        localStorage.removeItem('maian_user');
        if (typeof document !== 'undefined') {
          document.cookie = 'maian_logged_in=; path=/; max-age=0; SameSite=Lax';
        }
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
          router.push('/login?session=expired');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const getDashboardPath = (role: Role) => {
    if (role === 'ADMIN' || role === 'CEO') return '/admin';
    if (role === 'MARKETING') return '/admin';
    return '/admin';
  };

  const login = (email: string, role: Role, name?: string, avatar_url?: string, employee_id?: string, employee_code?: string, _access_token?: string, id?: string, phone?: string, allowed_paths?: string[], permissions?: string[]) => {
    const userData: User = withoutAccessToken({
      email, 
      role, 
      name: name || email.split('@')[0].toUpperCase(), 
      avatar_url, 
      employee_id, 
      employee_code,
      access_token: _access_token,
      id, 
      phone,
      allowed_paths,
      permissions,
    });
    setUser(userData);
    localStorage.setItem('maian_user', JSON.stringify(userData));
    if (typeof document !== 'undefined') {
      document.cookie = 'maian_logged_in=1; path=/; max-age=86400; SameSite=Lax';
    }
    router.push(getDashboardPath(role));
  };

  const updateAvatar = useCallback((avatar_url: string) => {
    setUser((current) => {
      if (!current || current.avatar_url === avatar_url) return current;
      const updated = { ...current, avatar_url };
      localStorage.setItem('maian_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateProfile = useCallback((profile: { name?: string; phone?: string; avatar_url?: string }) => {
    setUser((current) => {
      if (!current) return current;
      const updated = {
        ...current,
        ...(profile.name !== undefined ? { name: profile.name } : {}),
        ...(profile.phone !== undefined ? { phone: profile.phone } : {}),
        ...(profile.avatar_url !== undefined ? { avatar_url: profile.avatar_url } : {}),
      };
      localStorage.setItem('maian_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout API call failed (may already be expired):', err);
    } finally {
      setUser(null);
      localStorage.removeItem('maian_user');
      if (typeof document !== 'undefined') {
        document.cookie = 'maian_logged_in=; path=/; max-age=0; SameSite=Lax';
      }
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateAvatar, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
