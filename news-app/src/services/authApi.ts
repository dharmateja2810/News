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
  emailVerified?: boolean;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  user: BackendUser;
  token: string;
  message?: string;
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

export async function googleAuthApi(idToken: string, user: any): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/google/token', { idToken, user });
  return res.data;
}

export async function appleAuthApi(identityToken: string, user: any): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/apple/token', { identityToken, user });
  return res.data;
}

export async function resendVerificationEmail(email: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>('/auth/resend-verification', { email });
  return res.data;
}


