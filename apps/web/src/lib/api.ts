export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SourceType = "rss" | "official_blog" | "news_site" | "research_feed" | "github_release" | "manual";

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  sourceType: SourceType;
  category: string | null;
  trustLevel: number;
  enabled: boolean;
  crawlIntervalMinutes: number;
  lastCrawledAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceWriteInput {
  name: string;
  url: string;
  sourceType?: SourceType;
  category?: string | null;
  trustLevel?: number;
  enabled?: boolean;
  crawlIntervalMinutes?: number;
}

export type SourceUpdateInput = Partial<SourceWriteInput>;

export type ArticleStatus = "fetched" | "embedded" | "clustered" | "summarized" | "pending_review" | "approved" | "rejected" | "published" | "fetch_failed";

export interface ArticleRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  originalUrl: string;
  canonicalUrl: string | null;
  title: string;
  description: string | null;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
}

export type FactCheckStatus = "verified" | "likely_true" | "partially_verified" | "unverified" | "disputed" | "low_quality";

export interface SummaryRecord {
  id: string;
  articleClusterId: string;
  clusterTitle: string;
  headline: string;
  summary: string;
  keywords: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  confidenceScore: number | null;
  factCheckStatus: FactCheckStatus;
  approvedForPublish: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  articleClusterId: string;
  reviewerName: string | null;
  decision: "approve" | "reject";
  notes: string | null;
  decidedAt: string;
}

export interface ReviewCreateInput {
  reviewerName?: string | null;
  decision: "approve" | "reject";
  notes?: string | null;
}

export interface PublishedArticleRecord {
  id: string;
  articleClusterId: string;
  slug: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  sourceUrl: string;
  sourceName: string | null;
  confidenceScore: number | null;
  factCheckStatus: FactCheckStatus;
  publishedAt: string;
  updatedAt: string;
}

export interface ClusterListItem {
  id: string;
  clusterTitle: string;
  articleCount: number;
  summary: SummaryRecord | null;
  factCheckStatus: FactCheckStatus;
  confidenceScore: number;
  reviewStatus: "unreviewed" | "approved" | "rejected";
  published: PublishedArticleRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClusterDetail extends ClusterListItem {
  articles: ArticleRecord[];
  reviews: ReviewRecord[];
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface StatsResponse {
  articles: {
    total: number;
    fetched: number;
    embedded: number;
    clustered: number;
    summarized: number;
    pending_review: number;
    approved: number;
    rejected: number;
    published: number;
    fetch_failed: number;
  };
  clusters: {
    total: number;
    published: number;
    approved: number;
    rejected: number;
  };
  sources: {
    total: number;
    enabled: number;
    healthy: number;
    unhealthy: number;
  };
  pipeline: {
    schedule: string;
    queueMode: "bullmq" | "direct";
    queues: {
      ingest: QueueStats;
      embedding: QueueStats;
      cluster: QueueStats;
      summary: QueueStats;
      publish: QueueStats;
    };
  };
}

const API_BASE = `${import.meta.env.VITE_API_BASE ?? "http://localhost:4000"}/api`;
const AUTH_TOKEN_KEY = "ai_newsroom_auth_token";
const AUTH_USER_KEY = "ai_newsroom_auth_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuth(token: string, user: { email: string; name: string }): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getStoredUser(): { email: string; name: string } | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as { email: string; name: string };
  } catch {
    clearStoredAuth();
    return null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    clearStoredAuth();
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  health: () => apiFetch<HealthResponse>("/health"),
  stats: () => apiFetch<StatsResponse>("/stats"),
  sources: (page = 1, limit = 50) =>
    apiFetch<PaginatedResponse<SourceRecord>>(`/sources?page=${page}&limit=${limit}`),
  createSource: (payload: SourceWriteInput) =>
    apiFetch<SourceRecord>("/sources", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSource: (id: string, payload: SourceUpdateInput) =>
    apiFetch<SourceRecord>(`/sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteSource: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/sources/${id}`, {
      method: "DELETE",
    }),
  articles: (page = 1, limit = 20, status?: string) =>
    apiFetch<PaginatedResponse<ArticleRecord>>(
      `/articles?page=${page}&limit=${limit}${status ? `&status=${status}` : ""}`,
    ),
  article: (id: string) => apiFetch<ArticleRecord>(`/articles/${id}`),
  updateArticleStatus: (id: string, status: "fetched" | "approved" | "rejected") =>
    apiFetch<ArticleRecord>(`/articles/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  clusters: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<ClusterListItem>>(`/clusters?page=${page}&limit=${limit}`),
  cluster: (id: string) => apiFetch<ClusterDetail>(`/clusters/${id}`),
  summaries: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<SummaryRecord>>(`/summaries?page=${page}&limit=${limit}`),
  addReview: (clusterId: string, payload: ReviewCreateInput) =>
    apiFetch<ReviewRecord>(`/clusters/${clusterId}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publishCluster: (clusterId: string, slug?: string) =>
    apiFetch<PublishedArticleRecord>(`/clusters/${clusterId}/publish`, {
      method: "POST",
      body: JSON.stringify(slug ? { slug } : {}),
    }),
  published: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<PublishedArticleRecord>>(
      `/published?page=${page}&limit=${limit}`,
    ),
};

export type {
  ArticleRecord as ApiArticle,
  ClusterDetail as ApiClusterDetail,
  ClusterListItem as ApiCluster,
  PublishedArticleRecord as ApiPublishedArticle,
  ReviewRecord as ApiReview,
  SourceRecord as ApiSource,
  StatsResponse as ApiStats,
  SummaryRecord as ApiSummary,
};
