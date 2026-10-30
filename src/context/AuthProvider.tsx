import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { AUTH_UNAUTHORIZED_EVENT } from "../auth/auth-events";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  clearAuthSession,
  getStoredAccessToken,
  getStoredAuthUser,
  storeAuthSession,
  storeAuthUser,
} from "../auth/auth-storage";
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from "../auth/auth.types";
import { getCurrentUser, updateCurrentUser } from "../api/users.api";
import { apiRequest, ApiError } from "../lib/api-client";
import { AuthContext } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredAccessToken()));
  const validationSequence = useRef(0);

  const applySession = useCallback((session: AuthSession) => {
    storeAuthSession(session);
    setUser(session.user);
    setIsLoading(false);
  }, []);

  const clearSession = useCallback(() => {
    validationSequence.current += 1;
    clearAuthSession();
    setUser(null);
    setIsLoading(false);
  }, []);

  const syncUser = useCallback((nextUser: AuthUser) => {
    storeAuthUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const validateStoredSession = useCallback(async () => {
    const token = getStoredAccessToken();
    const cachedUser = getStoredAuthUser();
    const sequence = ++validationSequence.current;

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = await getCurrentUser();

      if (sequence !== validationSequence.current) {
        return;
      }

      syncUser(currentUser);
    } catch (error) {
      if (sequence !== validationSequence.current) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        clearSession();
      } else {
        setUser(cachedUser);
      }
    } finally {
      if (sequence === validationSequence.current) {
        setIsLoading(false);
      }
    }
  }, [clearSession, syncUser]);

  useEffect(() => {
    void validateStoredSession();
  }, [validateStoredSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      navigate("/login", { replace: true });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACCESS_TOKEN_STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        clearSession();
        return;
      }

      void validateStoredSession();
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearSession, navigate, validateStoredSession]);

  const login = useCallback(async (input: LoginInput) => {
    const session = await apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: input,
    });

    applySession(session);
    return session.user;
  }, [applySession]);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await apiRequest<AuthSession>("/auth/register", {
      method: "POST",
      body: input,
    });

    applySession(session);
    return session.user;
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    return syncUser(currentUser);
  }, [syncUser]);

  const updateUser = useCallback(async (input: Parameters<typeof updateCurrentUser>[0]) => {
    const updatedUser = await updateCurrentUser(input);
    return syncUser(updatedUser);
  }, [syncUser]);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && getStoredAccessToken()),
        isLoading,
        login,
        register,
        refreshUser,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
