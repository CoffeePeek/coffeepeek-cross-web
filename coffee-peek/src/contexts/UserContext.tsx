import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getUserRoles, getUserEmail, getUserId, isTokenExpired, isEmailVerified } from '../utils/jwt';
import { TokenManager } from '../api/core/httpClient';
import { ensureFreshAccessToken, LOGGED_OUT_KEY } from '../api/core/interceptors';
import { API_BASE_URL } from '../api/core/apiConfig';
import { getProfile, logout as apiLogout, type UserProfile } from '../api/auth';
import { queryClient } from '../lib/queryClient';
import { changeCatalogSession, getCatalogScope } from '../lib/catalogSession';


export interface AppUser {
  address?: UserProfile['address'];
  id: string | null;
  email: string | null;
  userName?: string;
  avatarUrl?: string;
  roles: string[];
  emailConfirmed: boolean;
}

interface UserContextType {
  user: AppUser | null;
  isLoading: boolean;
  updateUserFromToken: (token: string) => void;
  updateUserProfile: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  clearSession: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserContextType['user']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userId = user?.id;

  const updateUserFromToken = useCallback((token: string) => {
    if (!token || isTokenExpired(token)) {
      TokenManager.clearTokens();
      changeCatalogSession(null, true);
      void queryClient.cancelQueries();
      queryClient.clear();
      setUser(null);
      return;
    }

    localStorage.removeItem(LOGGED_OUT_KEY);
    const roles = getUserRoles(token);
    const email = getUserEmail(token);
    const id = getUserId(token);
    const emailConfirmed = isEmailVerified(token);

    const previousScope = getCatalogScope();
    changeCatalogSession(id || null);
    if (previousScope !== getCatalogScope()) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }

    setUser({
      id: id || '',
      email: email || '',
      roles,
      emailConfirmed,
    });
    setIsLoading(false);
  }, []);

  const updateUserProfile = useCallback((profile: UserProfile) => {
    setUser(currentUser => currentUser ? {
      ...currentUser,
      email: profile.email || currentUser.email,
      userName: profile.userName,
      address: profile.address,
      avatarUrl: profile.avatarUrl,
    } : currentUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.setItem(LOGGED_OUT_KEY, '1');
    TokenManager.clearTokens();
    changeCatalogSession(null, true);
    sessionStorage.removeItem('coffeepeek.favoriteIntent');
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    changeCatalogSession(null, true);
    const logoutScope = getCatalogScope();
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setIsLoading(true);
    const request = apiLogout();
    try {
      await request;
    } catch {
      // Keep the browser logged out even if the server is temporarily unavailable.
    } finally {
      if (logoutScope === getCatalogScope()) { clearSession(); setIsLoading(false); }
    }
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    const restoredScope = getCatalogScope();

    const restoreSession = async () => {
      try {
        if (localStorage.getItem(LOGGED_OUT_KEY) === '1') {
          TokenManager.clearTokens();
          setUser(null);
          return;
        }
        const fresh = await ensureFreshAccessToken(API_BASE_URL);
        if (cancelled || restoredScope !== getCatalogScope()) return;
        const token = TokenManager.getAccessToken();
        if (fresh && token) {
          updateUserFromToken(token);
        } else {
          TokenManager.clearTokens();
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Детали кофеен содержат пользовательские поля (userCheckIns) —
  // при смене пользователя кэш анонимной/чужой версии устаревает.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['coffeeShops'] });
  }, [userId]);

  useEffect(() => {
    if (userId === undefined) return;

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        if (!cancelled) updateUserProfile(response.data);
      } catch {
        // The token data is enough to keep the session usable if profile loading fails.
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId, updateUserProfile]);

  return (
    <UserContext.Provider value={{ user, isLoading, updateUserFromToken, updateUserProfile, logout, clearSession }}>
      {children}
    </UserContext.Provider>
  );
};
