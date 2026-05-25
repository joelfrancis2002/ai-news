import { apiClient } from "./apiClient";

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

export const api = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login", { email, password }),
  health: () => apiClient.get<HealthResponse>("/health"),
  stats: () => apiClient.get<StatsResponse>("/stats"),
  sources: (page = 1, limit = 50) =>
    apiClient.get<PaginatedResponse<SourceRecord>>("/sources", { page, limit }),
  createSource: (payload: SourceWriteInput) =>
    apiClient.post<SourceRecord>("/sources", payload),
  updateSource: (id: string, payload: SourceUpdateInput) =>
    apiClient.patch<SourceRecord>(`/sources/${id}`, payload),
  deleteSource: (id: string) =>
    apiClient.del<{ deleted: boolean }>(`/sources/${id}`),
  articles: (page = 1, limit = 20, status?: string) =>
    apiClient.get<PaginatedResponse<ArticleRecord>>(
      "/articles",
      status ? { page, limit, status } : { page, limit }
    ),
  article: (id: string) => apiClient.get<ArticleRecord>(`/articles/${id}`),
  updateArticleStatus: (id: string, status: "fetched" | "approved" | "rejected") =>
    apiClient.patch<ArticleRecord>(`/articles/${id}/status`, { status }),
  clusters: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<ClusterListItem>>("/clusters", { page, limit }),
  cluster: (id: string) => apiClient.get<ClusterDetail>(`/clusters/${id}`),
  summaries: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<SummaryRecord>>("/summaries", { page, limit }),
  addReview: (clusterId: string, payload: ReviewCreateInput) =>
    apiClient.post<ReviewRecord>(`/clusters/${clusterId}/reviews`, payload),
  publishCluster: (clusterId: string, slug?: string) =>
    apiClient.post<PublishedArticleRecord>(`/clusters/${clusterId}/publish`, slug ? { slug } : {}),
  published: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<PublishedArticleRecord>>("/published", { page, limit }),
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
