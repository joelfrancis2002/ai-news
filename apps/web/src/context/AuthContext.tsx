import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, clearStoredAuth, getStoredToken, getStoredUser, setStoredAuth } from "../lib/api";

type AuthUser = {
  email: string;
  name: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredToken()));

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setStoredAuth(response.token, response.user);
    setUser(response.user);
    setIsAuthenticated(true);
    return true;
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      login,
      logout,
    }),
    [isAuthenticated, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
