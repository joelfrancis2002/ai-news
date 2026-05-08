export const WORKSPACE_NAME = "ai-newsroom" as const;

export const ARTICLE_STATUSES = [
  "fetched",
  "embedded",
  "clustered",
  "summarized",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "fetch_failed",
] as const;

export const MUTABLE_ARTICLE_STATUSES = [
  "fetched",
  "approved",
  "rejected",
] as const;

export const SOURCE_TYPES = [
  "rss",
  "official_blog",
  "news_site",
  "research_feed",
  "github_release",
  "manual",
] as const;

export const FACT_CHECK_STATUSES = [
  "verified",
  "likely_true",
  "partially_verified",
  "unverified",
  "disputed",
  "low_quality",
] as const;

export const REVIEW_DECISIONS = ["approve", "reject"] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export type MutableArticleStatus = (typeof MUTABLE_ARTICLE_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type FactCheckStatus = (typeof FACT_CHECK_STATUSES)[number];
export type ReviewDecisionType = (typeof REVIEW_DECISIONS)[number];

export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

export type PipelineQueueStats = {
  ingest: QueueStats;
  embedding: QueueStats;
  cluster: QueueStats;
  summary: QueueStats;
  publish: QueueStats;
};

export type PipelineStatusResponse = {
  schedule: string;
  queueMode: "bullmq";
  queues: PipelineQueueStats;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthUser = {
  email: string;
  name: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type SourceRecord = {
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
};

export type SourceWriteInput = {
  name: string;
  url: string;
  sourceType?: SourceType;
  category?: string | null;
  trustLevel?: number;
  enabled?: boolean;
  crawlIntervalMinutes?: number;
};

export type SourceUpdateInput = Partial<SourceWriteInput>;

export type ArticleRecord = {
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
};

export type ArticleListItem = ArticleRecord;

export type SummaryRecord = {
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
};

export type ReviewRecord = {
  id: string;
  articleClusterId: string;
  reviewerName: string | null;
  decision: ReviewDecisionType;
  notes: string | null;
  decidedAt: string;
};

export type ReviewCreateInput = {
  reviewerName?: string | null;
  decision: ReviewDecisionType;
  notes?: string | null;
};

export type PublishedArticleRecord = {
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
};

export type PublishInput = {
  slug?: string;
};

export type ClusterListItem = {
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
};

export type ClusterDetail = ClusterListItem & {
  articles: ArticleListItem[];
  reviews: ReviewRecord[];
};

export type StatsResponse = {
  articles: Record<ArticleStatus, number> & { total: number };
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
  pipeline: PipelineStatusResponse;
};

export type IngestJobPayload = {
  sourceId: string;
};

export type EmbeddingJobPayload = {
  articleId: string;
};

export type ClusterJobPayload = {
  trigger: "embedded-ready";
};

export type SummaryJobPayload = {
  clusterId: string;
};

export type PublishJobPayload = {
  clusterId: string;
};

export type LlmSummaryInput = {
  clusterTitle: string;
  articles: Array<{
    title: string;
    description: string | null;
    content: string | null;
    sourceName: string;
    originalUrl: string;
  }>;
};

export type LlmSummaryOutput = {
  headline: string;
  summary: string;
  keywords: string[];
  confidenceScore: number;
  factCheckStatus: FactCheckStatus;
};
