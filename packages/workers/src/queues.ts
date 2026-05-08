import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type {
  ClusterJobPayload,
  EmbeddingJobPayload,
  IngestJobPayload,
  PipelineQueueStats,
  PublishJobPayload,
  SummaryJobPayload,
} from "@ai-newsroom/shared";

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return redisConnection;
}

export const QUEUE_NAMES = {
  INGEST: "ingestQueue",
  EMBEDDING: "embeddingQueue",
  CLUSTER: "clusterQueue",
  SUMMARY: "summaryQueue",
  PUBLISH: "publishQueue",
} as const;

let ingestQueue: Queue<IngestJobPayload> | null = null;
let embeddingQueue: Queue<EmbeddingJobPayload> | null = null;
let clusterQueue: Queue<ClusterJobPayload> | null = null;
let summaryQueue: Queue<SummaryJobPayload> | null = null;
let publishQueue: Queue<PublishJobPayload> | null = null;

function baseQueueOptions() {
  return {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 250,
      removeOnFail: 100,
      backoff: {
        type: "exponential" as const,
        delay: 5000,
      },
    },
  };
}

export function getIngestQueue(): Queue<IngestJobPayload> {
  if (!ingestQueue) {
    ingestQueue = new Queue<IngestJobPayload>(QUEUE_NAMES.INGEST, baseQueueOptions());
  }
  return ingestQueue;
}

export function getEmbeddingQueue(): Queue<EmbeddingJobPayload> {
  if (!embeddingQueue) {
    embeddingQueue = new Queue<EmbeddingJobPayload>(QUEUE_NAMES.EMBEDDING, baseQueueOptions());
  }
  return embeddingQueue;
}

export function getClusterQueue(): Queue<ClusterJobPayload> {
  if (!clusterQueue) {
    clusterQueue = new Queue<ClusterJobPayload>(QUEUE_NAMES.CLUSTER, baseQueueOptions());
  }
  return clusterQueue;
}

export function getSummaryQueue(): Queue<SummaryJobPayload> {
  if (!summaryQueue) {
    summaryQueue = new Queue<SummaryJobPayload>(QUEUE_NAMES.SUMMARY, baseQueueOptions());
  }
  return summaryQueue;
}

export function getPublishQueue(): Queue<PublishJobPayload> {
  if (!publishQueue) {
    publishQueue = new Queue<PublishJobPayload>(QUEUE_NAMES.PUBLISH, baseQueueOptions());
  }
  return publishQueue;
}

export async function getQueueStats(): Promise<PipelineQueueStats> {
  const [ingestRaw, embeddingRaw, clusterRaw, summaryRaw, publishRaw] = await Promise.all([
    getIngestQueue().getJobCounts("waiting", "active", "completed", "failed"),
    getEmbeddingQueue().getJobCounts("waiting", "active", "completed", "failed"),
    getClusterQueue().getJobCounts("waiting", "active", "completed", "failed"),
    getSummaryQueue().getJobCounts("waiting", "active", "completed", "failed"),
    getPublishQueue().getJobCounts("waiting", "active", "completed", "failed"),
  ]);

  return {
    ingest: {
      waiting: ingestRaw.waiting ?? 0,
      active: ingestRaw.active ?? 0,
      completed: ingestRaw.completed ?? 0,
      failed: ingestRaw.failed ?? 0,
    },
    embedding: {
      waiting: embeddingRaw.waiting ?? 0,
      active: embeddingRaw.active ?? 0,
      completed: embeddingRaw.completed ?? 0,
      failed: embeddingRaw.failed ?? 0,
    },
    cluster: {
      waiting: clusterRaw.waiting ?? 0,
      active: clusterRaw.active ?? 0,
      completed: clusterRaw.completed ?? 0,
      failed: clusterRaw.failed ?? 0,
    },
    summary: {
      waiting: summaryRaw.waiting ?? 0,
      active: summaryRaw.active ?? 0,
      completed: summaryRaw.completed ?? 0,
      failed: summaryRaw.failed ?? 0,
    },
    publish: {
      waiting: publishRaw.waiting ?? 0,
      active: publishRaw.active ?? 0,
      completed: publishRaw.completed ?? 0,
      failed: publishRaw.failed ?? 0,
    },
  };
}

export async function enqueueClusterSweep(): Promise<void> {
  await getClusterQueue().add(
    "cluster-ready",
    { trigger: "embedded-ready" },
    { jobId: "cluster-ready" },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    ingestQueue?.close(),
    embeddingQueue?.close(),
    clusterQueue?.close(),
    summaryQueue?.close(),
    publishQueue?.close(),
  ]);
  await redisConnection?.quit();
}
