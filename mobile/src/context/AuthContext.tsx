import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  authApi,
  setUnauthorizedListener,
  tokenStorage,
  usersApi,
  type UserRead,
} from '../api';

interface AuthContextValue {
  user: UserRead | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  logoutReason: string | null;
  clearLogoutReason: () => void;
  signIn: (email: string, password: string) => Promise<UserRead>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<UserRead | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  const clearLogoutReason = useCallback(() => setLogoutReason(null), []);

  const refreshUser = useCallback(async (): Promise<UserRead | null> => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        setUser(null);
        return null;
      }
      const me = await usersApi.getMe();
      if (me.account_status !== 'active') {
        await tokenStorage.clearTokens();
        setLogoutReason(`Account is ${me.account_status}. Please contact NED Transport Admin.`);
        setUser(null);
        return null;
      }
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedListener((reason) => {
      setLogoutReason(
        reason || 'Your session expired or your account was suspended. Please sign in again.',
      );
      setUser(null);
    });
    return () => setUnauthorizedListener(null);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = NetInfo.addEventListener((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        setIsOffline(offline);
      });
    } catch {
      // ignore if NetInfo native module unavailable
    }
    return () => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<UserRead> => {
    setLogoutReason(null);
    const tokens = await authApi.login({ email: email.trim().toLowerCase(), password });
    await tokenStorage.saveTokens(tokens.access_token, tokens.refresh_token);
    const me = await usersApi.getMe();
    setUser(me);
    return me;
  }, []);

  const signOut = useCallback(async () => {
    setLogoutReason(null);
    try {
      const refresh = await tokenStorage.getRefreshToken();
      await authApi.logout(refresh);
    } catch {
      // Clear local session even if server logout fails
    } finally {
      await tokenStorage.clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isOffline,
        logoutReason,
        clearLogoutReason,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
