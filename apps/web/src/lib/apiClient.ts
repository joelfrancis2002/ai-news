export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const AUTH_TOKEN_STORAGE_KEY = "ai-newsroom-auth-token";
const AUTH_REFRESH_TOKEN_STORAGE_KEY = "ai-newsroom-refresh-token";
const DEFAULT_TIMEOUT_MS = 10000;

function getTokenFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function getRefreshTokenFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
}

export function setStoredTokens(token: string, refreshToken: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    window.localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
}

export function clearTokenAndRedirect(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
    window.location.replace("/login");
  }
}

function buildQueryString(params: Record<string, string | number | boolean> = {}): string {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.set(key, String(value));
  });
  const query = queryParams.toString();
  return query ? `?${query}` : "";
}

function parseJsonOrText(response: Response): Promise<unknown> {
  return response.text().then((text) => {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  });
}

function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (url && typeof url === "string") {
    return url.replace(/\/+$/g, "");
  }

  if (import.meta.env.MODE === "development") {
    // REASON: Provide a safe local fallback for developers who haven't created a local env file yet.
    return "http://localhost:4000/api";
  }

  throw new Error("VITE_API_URL must be set in the frontend environment.");
}

const baseUrl = getBaseUrl();

type RequestOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export class ApiClient {
  private static refreshPromise: Promise<{ token: string; refreshToken: string }> | null = null;
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    const token = getTokenFromStorage();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const isRefreshRoute = normalizedEndpoint === "/auth/refresh";

    const response = await fetch(`${this.baseUrl}${normalizedEndpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    window.clearTimeout(timeout);

    if (response.status === 401 && !isRefreshRoute) {
      const refreshToken = getRefreshTokenFromStorage();
      if (refreshToken) {
        try {
          if (!ApiClient.refreshPromise) {
            ApiClient.refreshPromise = (async () => {
              const res = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
              });
              if (!res.ok) {
                throw new Error("Refresh failed");
              }
              const data = (await res.json()) as { token: string; refreshToken: string };
              setStoredTokens(data.token, data.refreshToken);
              return data;
            })();
          }

          const newTokens = await ApiClient.refreshPromise;
          ApiClient.refreshPromise = null;

          const newHeaders = {
            ...headers,
            Authorization: `Bearer ${newTokens.token}`,
          };
          const retryResponse = await fetch(`${this.baseUrl}${normalizedEndpoint}`, {
            method,
            headers: newHeaders,
            body: body === undefined ? undefined : JSON.stringify(body),
          });

          if (retryResponse.status === 401) {
            clearTokenAndRedirect();
            throw new ApiError(401, "Unauthorized", null);
          }

          const retryPayload = await parseJsonOrText(retryResponse);
          if (!retryResponse.ok) {
            throw new ApiError(retryResponse.status, "Retry request failed", retryPayload);
          }
          return retryPayload as T;
        } catch (error) {
          ApiClient.refreshPromise = null;
          clearTokenAndRedirect();
          throw new ApiError(401, "Unauthorized", null);
        }
      } else {
        clearTokenAndRedirect();
        throw new ApiError(401, "Unauthorized", null);
      }
    } else if (response.status === 401 && isRefreshRoute) {
      clearTokenAndRedirect();
      throw new ApiError(401, "Unauthorized", null);
    }

    const payload = await parseJsonOrText(response);

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message?: unknown }).message ?? response.statusText)
          : response.statusText;
      throw new ApiError(response.status, message, payload);
    }

    return payload as T;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean>, options?: RequestOptions): Promise<T> {
    const queryString = params ? buildQueryString(params) : "";
    return this.request<T>(`${endpoint}${queryString}`, "GET", undefined, options);
  }

  async post<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, "POST", body, options);
  }

  async put<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, "PUT", body, options);
  }

  async patch<T, B = unknown>(endpoint: string, body: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, "PATCH", body, options);
  }

  async del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, "DELETE", undefined, options);
  }
}

export const apiClient = new ApiClient(baseUrl);
