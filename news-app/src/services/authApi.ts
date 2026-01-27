/**
 * Auth API
 */
import { api } from './api';

export type BackendTheme = 'light' | 'dark';

export interface BackendUser {
  id: string;
  email: string;
  name?: string | null;
  theme: BackendTheme;
}

export interface AuthResponse {
  user: BackendUser;
  token: string;
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function registerApi(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', params);
  return res.data;
}


