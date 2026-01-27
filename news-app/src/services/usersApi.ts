/**
 * Users API
 */
import { api } from './api';
import type { BackendTheme, BackendUser } from './authApi';

export async function getMe(): Promise<BackendUser> {
  const res = await api.get<BackendUser>('/users/me');
  return res.data;
}

export async function updateTheme(theme: BackendTheme): Promise<BackendUser> {
  const res = await api.patch<BackendUser>('/users/theme', { theme });
  return res.data;
}


