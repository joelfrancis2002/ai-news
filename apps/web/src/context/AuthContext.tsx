import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  userType: "admin" | "reader";
};

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
};

type AuthAction =
  | { type: "HYDRATE_START" }
  | { type: "HYDRATE_SUCCESS"; payload: { token: string; user: AuthUser } }
  | { type: "HYDRATE_FAILURE" }
  | { type: "LOGIN_SUCCESS"; payload: { token: string; user: AuthUser } }
  | { type: "LOGOUT" };

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  token: null,
  user: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "HYDRATE_START":
      return { ...state, isLoading: true };
    case "HYDRATE_SUCCESS":
    case "LOGIN_SUCCESS":
      return {
        isAuthenticated: true,
        isLoading: false,
        token: action.payload.token,
        user: action.payload.user,
      };
    case "HYDRATE_FAILURE":
    case "LOGOUT":
      return {
        isAuthenticated: false,
        isLoading: false,
        token: null,
        user: null,
      };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_STORAGE_KEY = "ai-newsroom-auth-token";
const AUTH_REFRESH_TOKEN_STORAGE_KEY = "ai-newsroom-refresh-token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function setStoredTokens(token: string, refreshToken: string): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

function clearStoredAuth(): void {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
}

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrId: string, password: string, loginType: "admin" | "reader") => Promise<boolean>;
  logout: () => Promise<void>;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Shift line numbers offset
  const hydrate = useCallback(async (active: boolean) => {
    dispatch({ type: "HYDRATE_START" });
    const token = getStoredToken();
    if (!token) {
      dispatch({ type: "HYDRATE_FAILURE" });
      return;
    }

    try {
      const response = await apiClient.get<{ user: AuthUser }>("/auth/me");
      if (!active) {
        return;
      }

      const activeToken = getStoredToken() ?? token;
      dispatch({ type: "HYDRATE_SUCCESS", payload: { token: activeToken, user: response.user } });
    } catch {
      if (!active) {
        return;
      }
      clearStoredAuth();
      dispatch({ type: "HYDRATE_FAILURE" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void hydrate(active);
    return () => {
      active = false;
    };
  }, [hydrate]);

  const login = useCallback(async (emailOrId: string, password: string, loginType: "admin" | "reader") => {
    const payload = loginType === "admin"
      ? { email: emailOrId, password, loginType }
      : { id: emailOrId, password, loginType };

    const response = await apiClient.post<{ token: string; refreshToken: string; user: AuthUser }, any>(
      "/auth/login",
      payload,
    );

    setStoredTokens(response.token, response.refreshToken);
    dispatch({ type: "LOGIN_SUCCESS", payload: { token: response.token, user: response.user } });
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post<{ success: boolean }, undefined>("/auth/logout", undefined);
    } catch {
      // Best-effort logout only; local auth state still wins.
    }

    clearStoredAuth();
    dispatch({ type: "LOGOUT" });
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      login,
      logout,
    }),
    [login, logout, state.isAuthenticated, state.isLoading, state.token, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
