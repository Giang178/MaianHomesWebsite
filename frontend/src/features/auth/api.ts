import { apiFetch } from '@/lib/api';

export const authApi = {
  login: (email: string, password: string) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, 'public'),
  passwordPolicy: () => apiFetch('/auth/password-policy', {}, 'public'),

  verify: () => apiFetch('/auth/verify', {
    method: 'GET',
  }, 'public'),

  logout: () => apiFetch('/auth/logout', {
    method: 'POST',
  }, 'public').catch(() => ({})),

  forgotPassword: (email: string) => apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, 'public'),

  resetPassword: (token: string, newPassword: string) => apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  }, 'public'),

  setupAccount: (token: string, password: string) => apiFetch('/auth/setup-account', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }, 'public'),

  completeFirstLogin: (newPassword: string) => apiFetch('/auth/complete-first-login', {
    method: 'POST', body: JSON.stringify({ new_password: newPassword }),
  }, 'public'),
};
