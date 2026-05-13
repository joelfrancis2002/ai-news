/**
 * @file apps/web/src/lib/axios-client.ts
 * Centralized API client with automatic token injection and refresh
 * Handles 401 responses by refreshing token and retrying request
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { getStoredTokens, setStoredTokens, clearStoredAuth } from './storage';

/**
 * Configure API base URL from environment
 * VITE_API_URL should be set in .env or default to localhost
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Create axios instance with production configuration
 * - withCredentials: Allow cookies for CORS requests
 * - timeout: Prevent hanging requests
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✓ CRITICAL: Send cookies with requests
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── State for refresh token queue ─────────────────────────────────────────
// Prevents multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

/**
 * Notify all pending requests with new token
 */
const processQueue = (error: any = null, token: string | null = null) => {
  refreshSubscribers.forEach(subscriber => {
    if (error) {
      subscriber.reject(error);
    } else {
      subscriber.resolve(token || '');
    }
  });

  isRefreshing = false;
  refreshSubscribers = [];
};

// ─── Request Interceptor: Inject Access Token ─────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokens = getStoredTokens();

    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Response Interceptor: Handle 401 & Refresh Token ──────────────────────

api.interceptors.response.use(
  // Success response
  (response) => {
    return response;
  },
  // Error response
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401 (unauthorized) errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      // Mark as retry to prevent infinite loop
      originalRequest._retry = true;
      isRefreshing = true;

      const tokens = getStoredTokens();

      // No refresh token available, can't recover
      if (!tokens?.refreshToken) {
        clearStoredAuth();
        processQueue(new Error('No refresh token available'));
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        const response = await axios.post<{
          accessToken: string;
          refreshToken?: string;
        }>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: tokens.refreshToken },
          {
            withCredentials: true,
            timeout: 5000,
          }
        );

        const { accessToken, refreshToken } = response.data;

        // Store new tokens
        setStoredTokens({
          accessToken,
          refreshToken: refreshToken || tokens.refreshToken,
        });

        // Update default header for future requests
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Process queued requests
        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        clearStoredAuth();
        processQueue(refreshError);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ─── API Methods ──────────────────────────────────────────────────────────

export const apiClient = {
  /**
   * Login with email and password
   */
  login: (email: string, password: string) =>
    api.post<{
      user: {
        id: string;
        email: string;
        name: string;
        roles: string[];
        permissions: string[];
      };
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
      sessionId: string;
    }>('/auth/login', { email, password }),

  /**
   * Refresh access token
   */
  refresh: (refreshToken: string) =>
    api.post<{
      accessToken: string;
      refreshToken?: string;
    }>('/auth/refresh', {
      refreshToken,
    }),

  /**
   * Logout and revoke session
   */
  logout: (sessionId?: string) =>
    api.post<{ success: boolean }>('/auth/logout', { sessionId }),

  /**
   * Get current user info
   */
  getMe: () =>
    api.get<{
      id: string;
      email: string;
      name: string;
      roles: string[];
      permissions: string[];
    }>('/auth/me'),

  /**
   * Get health status (no auth required)
   */
  health: () =>
    api.get<{ status: string; service: string; timestamp: string }>('/health', {
      headers: { Authorization: '' }, // Override to remove token
    }),
};

// ─── Error Handling Utilities ──────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    // Use server error message if available
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    // Handle common HTTP errors
    switch (error.response?.status) {
      case 400:
        return 'Invalid request';
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Not found';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.message || 'An error occurred';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response; // No response indicates network error
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  return false;
}

export function isRateLimited(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 429;
  }
  return false;
}

export { AxiosError };
