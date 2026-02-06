/**
 * Auth Context
 * - Stores JWT in SecureStore (native) or localStorage (web)
 * - Injects token into Axios via setApiAccessToken
 * - Handles global 401 via Axios interceptor callback
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setApiAccessToken, setUnauthorizedHandler } from '../services/api';
import { loginApi, registerApi, type BackendUser } from '../services/authApi';
import { getMe } from '../services/usersApi';
import { Storage } from '../utils/storage';
import { useTheme } from './ThemeContext';

const TOKEN_KEY = 'dailydigest_jwt';

// Web-safe token storage helpers
const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, value);
      return;
    }
    return SecureStore.setItemAsync(TOKEN_KEY, value);
  },
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    return SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

interface AuthContextType {
  isBootstrapping: boolean;
  token: string | null;
  user: BackendUser | null;
  setUser: (user: BackendUser | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setThemeMode } = useTheme();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<BackendUser | null>(null);

  const setUserAndPersist = async (nextUser: BackendUser | null) => {
    setUser(nextUser);
    if (nextUser) await Storage.saveUser(nextUser);
    else await Storage.removeUser();
  };

  const logout = async () => {
    setApiAccessToken(null);
    setToken(null);
    setUser(null);
    await tokenStorage.remove();
    await Storage.removeUser();
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Best-effort: if token is expired, drop back to login.
      void logout();
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await tokenStorage.get();
        if (!savedToken) return;

        setApiAccessToken(savedToken);
        setToken(savedToken);

        // Prefer live user from backend; fallback to cached user if call fails.
        try {
          const me = await getMe();
          await setUserAndPersist(me);
          setThemeMode(me.theme);
        } catch {
          const cached = await Storage.getUser();
          if (cached && typeof (cached as any).email === 'string') {
            setUser(cached as any);
          }
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, [setThemeMode]);

  const login = async (email: string, password: string) => {
    const res = await loginApi(email, password);
    await tokenStorage.set(res.token);
    setApiAccessToken(res.token);
    setToken(res.token);
    await setUserAndPersist(res.user);
    setThemeMode(res.user.theme);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await registerApi({ email, password, name });
    await tokenStorage.set(res.token);
    setApiAccessToken(res.token);
    setToken(res.token);
    await setUserAndPersist(res.user);
    setThemeMode(res.user.theme);
  };

  const value = useMemo<AuthContextType>(
    () => ({ isBootstrapping, token, user, setUser: setUserAndPersist, login, register, logout }),
    [isBootstrapping, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};


