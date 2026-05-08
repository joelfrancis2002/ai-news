import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { Prisma } from "@prisma/client";
import { getQueueStats } from "@ai-newsroom/workers/queues";
import { getAdminUser, issueAuthToken, requireAuth } from "./auth.js";

const ArticleStatusEnum = Type.Union([
  Type.Literal("fetched"),
  Type.Literal("embedded"),
  Type.Literal("clustered"),
  Type.Literal("summarized"),
  Type.Literal("pending_review"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("published"),
  Type.Literal("fetch_failed"),
]);

const FactCheckStatusEnum = Type.Union([
  Type.Literal("verified"),
  Type.Literal("likely_true"),
  Type.Literal("partially_verified"),
  Type.Literal("unverified"),
  Type.Literal("disputed"),
  Type.Literal("low_quality"),
]);

const SourceTypeEnum = Type.Union([
  Type.Literal("rss"),
  Type.Literal("official_blog"),
  Type.Literal("news_site"),
  Type.Literal("research_feed"),
  Type.Literal("github_release"),
  Type.Literal("manual"),
]);

const ReviewDecisionEnum = Type.Union([Type.Literal("approve"), Type.Literal("reject")]);

const PaginationQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

const UuidParam = Type.Object({ id: Type.String({ minLength: 1 }) });

const SourceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  url: Type.String(),
  sourceType: SourceTypeEnum,
  category: Type.Union([Type.String(), Type.Null()]),
  trustLevel: Type.Number(),
  enabled: Type.Boolean(),
  crawlIntervalMinutes: Type.Number(),
  lastCrawledAt: Type.Union([Type.String(), Type.Null()]),
  lastSuccessAt: Type.Union([Type.String(), Type.Null()]),
  lastFailureAt: Type.Union([Type.String(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const ArticleSchema = Type.Object({
  id: Type.String(),
  sourceId: Type.String(),
  sourceName: Type.String(),
  originalUrl: Type.String(),
  canonicalUrl: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  content: Type.Union([Type.String(), Type.Null()]),
  author: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  imageUrl: Type.Union([Type.String(), Type.Null()]),
  status: ArticleStatusEnum,
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const SummarySchema = Type.Object({
  id: Type.String(),
  articleClusterId: Type.String(),
  clusterTitle: Type.String(),
  headline: Type.String(),
  summary: Type.String(),
  keywords: Type.Array(Type.String()),
  sourceName: Type.Union([Type.String(), Type.Null()]),
  sourceUrl: Type.Union([Type.String(), Type.Null()]),
  imageUrl: Type.Union([Type.String(), Type.Null()]),
  confidenceScore: Type.Union([Type.Number(), Type.Null()]),
  factCheckStatus: FactCheckStatusEnum,
  approvedForPublish: Type.Boolean(),
  version: Type.Number(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const ReviewSchema = Type.Object({
  id: Type.String(),
  articleClusterId: Type.String(),
  reviewerName: Type.Union([Type.String(), Type.Null()]),
  decision: ReviewDecisionEnum,
  notes: Type.Union([Type.String(), Type.Null()]),
  decidedAt: Type.String(),
});

const PublishedSchema = Type.Object({
  id: Type.String(),
  articleClusterId: Type.String(),
  slug: Type.String(),
  headline: Type.String(),
  summary: Type.String(),
  imageUrl: Type.Union([Type.String(), Type.Null()]),
  sourceUrl: Type.String(),
  sourceName: Type.Union([Type.String(), Type.Null()]),
  confidenceScore: Type.Union([Type.Number(), Type.Null()]),
  factCheckStatus: FactCheckStatusEnum,
  publishedAt: Type.String(),
  updatedAt: Type.String(),
});

const ClusterSchema = Type.Object({
  id: Type.String(),
  clusterTitle: Type.String(),
  articleCount: Type.Number(),
  summary: Type.Union([SummarySchema, Type.Null()]),
  factCheckStatus: FactCheckStatusEnum,
  confidenceScore: Type.Number(),
  reviewStatus: Type.Union([
    Type.Literal("unreviewed"),
    Type.Literal("approved"),
    Type.Literal("rejected"),
  ]),
  published: Type.Union([PublishedSchema, Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const StatsSchema = Type.Object({
  articles: Type.Object({
    total: Type.Number(),
    fetched: Type.Number(),
    embedded: Type.Number(),
    clustered: Type.Number(),
    summarized: Type.Number(),
    pending_review: Type.Number(),
    approved: Type.Number(),
    rejected: Type.Number(),
    published: Type.Number(),
    fetch_failed: Type.Number(),
  }),
  clusters: Type.Object({
    total: Type.Number(),
    published: Type.Number(),
    approved: Type.Number(),
    rejected: Type.Number(),
  }),
  sources: Type.Object({
    total: Type.Number(),
    enabled: Type.Number(),
    healthy: Type.Number(),
    unhealthy: Type.Number(),
  }),
  pipeline: Type.Object({
    schedule: Type.String(),
    queueMode: Type.Literal("bullmq"),
    queues: Type.Object({
      ingest: Type.Object({
        waiting: Type.Number(),
        active: Type.Number(),
        completed: Type.Number(),
        failed: Type.Number(),
      }),
      embedding: Type.Object({
        waiting: Type.Number(),
        active: Type.Number(),
        completed: Type.Number(),
        failed: Type.Number(),
      }),
      cluster: Type.Object({
        waiting: Type.Number(),
        active: Type.Number(),
        completed: Type.Number(),
        failed: Type.Number(),
      }),
      summary: Type.Object({
        waiting: Type.Number(),
        active: Type.Number(),
        completed: Type.Number(),
        failed: Type.Number(),
      }),
      publish: Type.Object({
        waiting: Type.Number(),
        active: Type.Number(),
        completed: Type.Number(),
        failed: Type.Number(),
      }),
    }),
  }),
});

function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function reviewStatusFromDecision(decision: string | null): "unreviewed" | "approved" | "rejected" {
  if (decision === "approve") {
    return "approved";
  }
  if (decision === "reject") {
    return "rejected";
  }
  return "unreviewed";
}

function mapSource(source: {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  category: string | null;
  trustLevel: number;
  enabled: boolean;
  crawlIntervalMinutes: number;
  lastCrawledAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...source,
    sourceType: source.sourceType as
      | "rss"
      | "official_blog"
      | "news_site"
      | "research_feed"
      | "github_release"
      | "manual",
    lastCrawledAt: toIso(source.lastCrawledAt),
    lastSuccessAt: toIso(source.lastSuccessAt),
    lastFailureAt: toIso(source.lastFailureAt),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function mapArticle(article: {
  id: string;
  sourceId: string;
  originalUrl: string;
  canonicalUrl: string | null;
  title: string;
  description: string | null;
  content: string | null;
  author: string | null;
  publishedAt: Date | null;
  imageUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  source: { name: string };
}) {
  return {
    id: article.id,
    sourceId: article.sourceId,
    sourceName: article.source.name,
    originalUrl: article.originalUrl,
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    description: article.description,
    content: article.content,
    author: article.author,
    publishedAt: toIso(article.publishedAt),
    imageUrl: article.imageUrl,
    status: article.status as
      | "fetched"
      | "embedded"
      | "clustered"
      | "summarized"
      | "pending_review"
      | "approved"
      | "rejected"
      | "published"
      | "fetch_failed",
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

function mapSummary(
  summary: {
    id: string;
    articleClusterId: string;
    headline: string;
    summary: string;
    keywords: string[];
    sourceName: string | null;
    sourceUrl: string | null;
    imageUrl: string | null;
    confidenceScore: number | null;
    factCheckStatus: string;
    approvedForPublish: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    cluster?: { clusterTitle: string } | null;
  },
) {
  return {
    id: summary.id,
    articleClusterId: summary.articleClusterId,
    clusterTitle: summary.cluster?.clusterTitle ?? "",
    headline: summary.headline,
    summary: summary.summary,
    keywords: summary.keywords,
    sourceName: summary.sourceName,
    sourceUrl: summary.sourceUrl,
    imageUrl: summary.imageUrl,
    confidenceScore: summary.confidenceScore,
    factCheckStatus: summary.factCheckStatus as
      | "verified"
      | "likely_true"
      | "partially_verified"
      | "unverified"
      | "disputed"
      | "low_quality",
    approvedForPublish: summary.approvedForPublish,
    version: summary.version,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}

function mapReview(review: {
  id: string;
  articleClusterId: string;
  reviewerName: string | null;
  decision: string;
  notes: string | null;
  decidedAt: Date;
}) {
  return {
    id: review.id,
    articleClusterId: review.articleClusterId,
    reviewerName: review.reviewerName,
    decision: review.decision as "approve" | "reject",
    notes: review.notes,
    decidedAt: review.decidedAt.toISOString(),
  };
}

function mapPublished(published: {
  id: string;
  articleClusterId: string;
  slug: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  sourceUrl: string;
  sourceName: string | null;
  confidenceScore: number | null;
  factCheckStatus: string;
  publishedAt: Date;
  updatedAt: Date;
} | null) {
  if (!published) {
    return null;
  }

  return {
    ...published,
    factCheckStatus: published.factCheckStatus as
      | "verified"
      | "likely_true"
      | "partially_verified"
      | "unverified"
      | "disputed"
      | "low_quality",
    publishedAt: published.publishedAt.toISOString(),
    updatedAt: published.updatedAt.toISOString(),
  };
}

function mapCluster(cluster: {
  id: string;
  clusterTitle: string;
  factCheckStatus: string;
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { members: number };
  summaries: Array<{
    id: string;
    articleClusterId: string;
    headline: string;
    summary: string;
    keywords: string[];
    sourceName: string | null;
    sourceUrl: string | null;
    imageUrl: string | null;
    confidenceScore: number | null;
    factCheckStatus: string;
    approvedForPublish: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  reviews: Array<{ decision: string }>;
  published: {
    id: string;
    articleClusterId: string;
    slug: string;
    headline: string;
    summary: string;
    imageUrl: string | null;
    sourceUrl: string;
    sourceName: string | null;
    confidenceScore: number | null;
    factCheckStatus: string;
    publishedAt: Date;
    updatedAt: Date;
  } | null;
}) {
  const latestReview = cluster.reviews[0]?.decision ?? null;
  const latestSummary = cluster.summaries[0];

  return {
    id: cluster.id,
    clusterTitle: cluster.clusterTitle,
    articleCount: cluster._count.members,
    summary: latestSummary
      ? mapSummary({
          ...latestSummary,
          cluster: { clusterTitle: cluster.clusterTitle },
        })
      : null,
    factCheckStatus: cluster.factCheckStatus as
      | "verified"
      | "likely_true"
      | "partially_verified"
      | "unverified"
      | "disputed"
      | "low_quality",
    confidenceScore: cluster.confidenceScore,
    reviewStatus: reviewStatusFromDecision(latestReview),
    published: mapPublished(cluster.published),
    createdAt: cluster.createdAt.toISOString(),
    updatedAt: cluster.updatedAt.toISOString(),
  };
}

async function buildStats(prisma: FastifyPluginAsyncTypebox extends never ? never : any) {
  const [articleGroups, clusterCount, sourceStats, latestReviews, queueStats] = await Promise.all([
    prisma.rawArticle.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.articleCluster.count(),
    prisma.source.findMany({
      select: { enabled: true, lastSuccessAt: true, lastFailureAt: true },
    }),
    prisma.reviewDecision.findMany({
      distinct: ["articleClusterId"],
      orderBy: [{ articleClusterId: "asc" }, { decidedAt: "desc" }],
      select: { decision: true },
    }),
    getQueueStats(),
  ]);

  const baseCounts = {
    total: 0,
    fetched: 0,
    embedded: 0,
    clustered: 0,
    summarized: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    fetch_failed: 0,
  };

  for (const group of articleGroups) {
    const count = group._count.status;
    baseCounts.total += count;
    if (group.status in baseCounts) {
      (baseCounts as Record<string, number>)[group.status] = count;
    }
  }

  const approvedClusters = latestReviews.filter(
    (review: { decision: string }) => review.decision === "approve",
  ).length;
  const rejectedClusters = latestReviews.filter(
    (review: { decision: string }) => review.decision === "reject",
  ).length;

  const healthySources = sourceStats.filter(
    (source: { lastSuccessAt: Date | null; lastFailureAt: Date | null }) =>
      source.lastSuccessAt && !source.lastFailureAt,
  ).length;

  return {
    articles: baseCounts,
    clusters: {
      total: clusterCount,
      published: baseCounts.published,
      approved: approvedClusters,
      rejected: rejectedClusters,
    },
    sources: {
      total: sourceStats.length,
      enabled: sourceStats.filter((source: { enabled: boolean }) => source.enabled).length,
      healthy: healthySources,
      unhealthy: sourceStats.length - healthySources,
    },
    pipeline: {
      schedule: process.env.INGEST_CRON ?? "*/15 * * * *",
      queueMode: "bullmq" as const,
      queues: queueStats,
    },
  };
}

const routes: FastifyPluginAsyncTypebox = async (fastify) => {
  const prisma = fastify.prisma;

  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal("ok"),
            service: Type.String(),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async () => ({
      status: "ok",
      service: "ai-newsroom-api",
      timestamp: new Date().toISOString(),
    } as const),
  );

  fastify.post(
    "/auth/login",
    {
      schema: {
        body: Type.Object({
          email: Type.String({ format: "email" }),
          password: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            token: Type.String(),
            user: Type.Object({
              email: Type.String(),
              name: Type.String(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const admin = getAdminUser();
      if (request.body.email !== admin.email || request.body.password !== admin.password) {
        throw fastify.httpErrors.unauthorized("Invalid credentials");
      }

      return {
        token: issueAuthToken(admin.email),
        user: {
          email: admin.email,
          name: admin.name,
        },
      };
    },
  );

  fastify.get(
    "/stats",
    {
      preHandler: requireAuth,
      schema: { response: { 200: StatsSchema } },
    },
    async () => buildStats(prisma),
  );

  fastify.get(
    "/sources",
    {
      preHandler: requireAuth,
      schema: {
        querystring: PaginationQuery,
        response: {
          200: Type.Object({
            data: Type.Array(SourceSchema),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number(),
            totalPages: Type.Number(),
          }),
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const skip = (page - 1) * limit;

      const [sources, total] = await Promise.all([
        prisma.source.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.source.count(),
      ]);

      return {
        data: sources.map(mapSource),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  );

  fastify.post(
    "/sources",
    {
      preHandler: requireAuth,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          url: Type.String({ format: "uri" }),
          sourceType: Type.Optional(SourceTypeEnum),
          category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          trustLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
          enabled: Type.Optional(Type.Boolean()),
          crawlIntervalMinutes: Type.Optional(Type.Integer({ minimum: 5, maximum: 1440 })),
        }),
        response: { 201: SourceSchema },
      },
    },
    async (request, reply) => {
      const source = await prisma.source.create({
        data: {
          name: request.body.name,
          url: request.body.url,
          sourceType: request.body.sourceType ?? "rss",
          category: request.body.category ?? null,
          trustLevel: request.body.trustLevel ?? 3,
          enabled: request.body.enabled ?? true,
          crawlIntervalMinutes: request.body.crawlIntervalMinutes ?? 60,
        },
      });

      return reply.code(201).send(mapSource(source));
    },
  );

  fastify.patch(
    "/sources/:id",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          url: Type.Optional(Type.String({ format: "uri" })),
          sourceType: Type.Optional(SourceTypeEnum),
          category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          trustLevel: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
          enabled: Type.Optional(Type.Boolean()),
          crawlIntervalMinutes: Type.Optional(Type.Integer({ minimum: 5, maximum: 1440 })),
        }),
        response: { 200: SourceSchema },
      },
    },
    async (request) => {
      try {
        const updated = await prisma.source.update({
          where: { id: request.params.id },
          data: request.body,
        });
        return mapSource(updated);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          throw fastify.httpErrors.notFound("Source not found");
        }
        throw error;
      }
    },
  );

  fastify.delete(
    "/sources/:id",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        response: {
          200: Type.Object({ deleted: Type.Boolean() }),
        },
      },
    },
    async (request) => {
      try {
        await prisma.source.delete({ where: { id: request.params.id } });
        return { deleted: true };
      } catch (error) {
        if (isPrismaNotFound(error)) {
          throw fastify.httpErrors.notFound("Source not found");
        }
        throw error;
      }
    },
  );

  fastify.get(
    "/articles",
    {
      preHandler: requireAuth,
      schema: {
        querystring: Type.Composite([
          PaginationQuery,
          Type.Object({
            status: Type.Optional(ArticleStatusEnum),
          }),
        ]),
        response: {
          200: Type.Object({
            data: Type.Array(ArticleSchema),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number(),
            totalPages: Type.Number(),
          }),
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const skip = (page - 1) * limit;
      const where = request.query.status ? { status: request.query.status } : {};

      const [articles, total] = await Promise.all([
        prisma.rawArticle.findMany({
          where,
          skip,
          take: limit,
          orderBy: { publishedAt: "desc" },
          include: { source: { select: { name: true } } },
        }),
        prisma.rawArticle.count({ where }),
      ]);

      return {
        data: articles.map(mapArticle),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  );

  fastify.get(
    "/articles/:id",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        response: { 200: ArticleSchema },
      },
    },
    async (request) => {
      const article = await prisma.rawArticle.findUnique({
        where: { id: request.params.id },
        include: { source: { select: { name: true } } },
      });

      if (!article) {
        throw fastify.httpErrors.notFound("Article not found");
      }

      return mapArticle(article);
    },
  );

  fastify.patch(
    "/articles/:id/status",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        body: Type.Object({
          status: Type.Union([
            Type.Literal("fetched"),
            Type.Literal("approved"),
            Type.Literal("rejected"),
          ]),
        }),
        response: { 200: ArticleSchema },
      },
    },
    async (request) => {
      try {
        const article = await prisma.rawArticle.update({
          where: { id: request.params.id },
          data: { status: request.body.status },
          include: { source: { select: { name: true } } },
        });
        return mapArticle(article);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          throw fastify.httpErrors.notFound("Article not found");
        }
        throw error;
      }
    },
  );

  fastify.get(
    "/clusters",
    {
      preHandler: requireAuth,
      schema: {
        querystring: PaginationQuery,
        response: {
          200: Type.Object({
            data: Type.Array(ClusterSchema),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number(),
            totalPages: Type.Number(),
          }),
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const skip = (page - 1) * limit;

      const [clusters, total] = await Promise.all([
        prisma.articleCluster.findMany({
          skip,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { members: true } },
            summaries: { take: 1, orderBy: { createdAt: "desc" } },
            reviews: { take: 1, orderBy: { decidedAt: "desc" }, select: { decision: true } },
            published: true,
          },
        }),
        prisma.articleCluster.count(),
      ]);

      return {
        data: clusters.map(mapCluster),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  );

  fastify.get(
    "/clusters/:id",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        response: {
          200: Type.Composite([
            ClusterSchema,
            Type.Object({
              articles: Type.Array(ArticleSchema),
              reviews: Type.Array(ReviewSchema),
            }),
          ]),
        },
      },
    },
    async (request) => {
      const cluster = await prisma.articleCluster.findUnique({
        where: { id: request.params.id },
        include: {
          _count: { select: { members: true } },
          summaries: { take: 1, orderBy: { createdAt: "desc" } },
          reviews: { orderBy: { decidedAt: "desc" } },
          published: true,
          members: {
            include: {
              article: {
                include: { source: { select: { name: true } } },
              },
            },
          },
        },
      });

      if (!cluster) {
        throw fastify.httpErrors.notFound("Cluster not found");
      }

      return {
        ...mapCluster(cluster),
        articles: cluster.members.map((member) => mapArticle(member.article)),
        reviews: cluster.reviews.map(mapReview),
      };
    },
  );

  fastify.get(
    "/summaries",
    {
      preHandler: requireAuth,
      schema: {
        querystring: PaginationQuery,
        response: {
          200: Type.Object({
            data: Type.Array(SummarySchema),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number(),
            totalPages: Type.Number(),
          }),
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const skip = (page - 1) * limit;

      const [summaries, total] = await Promise.all([
        prisma.summary.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { cluster: { select: { clusterTitle: true } } },
        }),
        prisma.summary.count(),
      ]);

      return {
        data: summaries.map(mapSummary),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  );

  fastify.post(
    "/clusters/:id/reviews",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        body: Type.Object({
          reviewerName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          decision: ReviewDecisionEnum,
          notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
        response: { 201: ReviewSchema },
      },
    },
    async (request, reply) => {
      const cluster = await prisma.articleCluster.findUnique({
        where: { id: request.params.id },
        include: {
          summaries: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (!cluster) {
        throw fastify.httpErrors.notFound("Cluster not found");
      }

      const review = await prisma.reviewDecision.create({
        data: {
          articleClusterId: cluster.id,
          reviewerName: request.body.reviewerName ?? null,
          decision: request.body.decision,
          notes: request.body.notes ?? null,
        },
      });

      if (cluster.summaries[0]) {
        await prisma.summary.update({
          where: { id: cluster.summaries[0].id },
          data: {
            approvedForPublish: request.body.decision === "approve",
          },
        });
      }

      await prisma.rawArticle.updateMany({
        where: {
          clusterMembers: { some: { clusterId: cluster.id } },
        },
        data: {
          status: request.body.decision === "approve" ? "approved" : "rejected",
        },
      });

      return reply.code(201).send(mapReview(review));
    },
  );

  fastify.get(
    "/clusters/:id/reviews",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        response: {
          200: Type.Object({
            data: Type.Array(ReviewSchema),
          }),
        },
      },
    },
    async (request) => {
      const reviews = await prisma.reviewDecision.findMany({
        where: { articleClusterId: request.params.id },
        orderBy: { decidedAt: "desc" },
      });

      return { data: reviews.map(mapReview) };
    },
  );

  fastify.post(
    "/clusters/:id/publish",
    {
      preHandler: requireAuth,
      schema: {
        params: UuidParam,
        body: Type.Optional(
          Type.Object({
            slug: Type.Optional(Type.String({ minLength: 1 })),
          }),
        ),
        response: { 200: PublishedSchema },
      },
    },
    async (request) => {
      const cluster = await prisma.articleCluster.findUnique({
        where: { id: request.params.id },
        include: {
          summaries: { orderBy: { createdAt: "desc" }, take: 1 },
          published: true,
        },
      });

      if (!cluster) {
        throw fastify.httpErrors.notFound("Cluster not found");
      }

      if (cluster.published) {
        return mapPublished(cluster.published)!;
      }

      const summary = cluster.summaries[0];
      if (!summary || !summary.approvedForPublish) {
        throw fastify.httpErrors.badRequest("Cluster must be approved before publishing");
      }

      const slug = (request.body?.slug ?? summary.headline)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `cluster-${cluster.id.slice(0, 8)}`;

      const published = await prisma.publishedArticle.create({
        data: {
          articleClusterId: cluster.id,
          slug,
          headline: summary.headline,
          summary: summary.summary,
          imageUrl: summary.imageUrl,
          sourceUrl: summary.sourceUrl ?? "",
          sourceName: summary.sourceName,
          confidenceScore: summary.confidenceScore,
          factCheckStatus: summary.factCheckStatus,
        },
      });

      await prisma.rawArticle.updateMany({
        where: {
          clusterMembers: { some: { clusterId: cluster.id } },
        },
        data: { status: "published" },
      });

      return mapPublished(published)!;
    },
  );

  fastify.get(
    "/published",
    {
      preHandler: requireAuth,
      schema: {
        querystring: PaginationQuery,
        response: {
          200: Type.Object({
            data: Type.Array(PublishedSchema),
            total: Type.Number(),
            page: Type.Number(),
            limit: Type.Number(),
            totalPages: Type.Number(),
          }),
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const skip = (page - 1) * limit;

      const [published, total] = await Promise.all([
        prisma.publishedArticle.findMany({
          skip,
          take: limit,
          orderBy: { publishedAt: "desc" },
        }),
        prisma.publishedArticle.count(),
      ]);

      return {
        data: published.map((item) => mapPublished(item)!),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  );
};

export default routes;
