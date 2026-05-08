import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import cron from "node-cron";
import { Worker } from "bullmq";
import { prisma } from "@ai-newsroom/database";
import {
  closeQueues,
  getRedisConnection,
  QUEUE_NAMES,
  getIngestQueue,
} from "./queues.js";
import { processIngestJob } from "./processors/ingest.js";
import { processEmbeddingJob } from "./processors/embedding.js";
import { processClusterJob } from "./processors/cluster.js";
import { processSummaryJob } from "./processors/summary.js";
import { processPublishJob } from "./processors/publish.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const INGEST_CRON = process.env.INGEST_CRON ?? "*/15 * * * *";
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

function createWorker<TData>(
  queueName: string,
  processor: (data: TData) => Promise<void>,
): Worker<TData> {
  return new Worker<TData>(
    queueName,
    async (job) => processor(job.data),
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY,
    },
  );
}

async function enqueueEnabledSources(): Promise<void> {
  const sources = await prisma.source.findMany({
    where: { enabled: true },
    select: { id: true },
  });

  await Promise.all(
    sources.map((source) =>
      getIngestQueue().add("ingest-source", { sourceId: source.id }, { jobId: `ingest:${source.id}` }),
    ),
  );
}

async function main(): Promise<void> {
  console.log("[workers] Starting BullMQ pipeline");
  console.log(`[workers] Schedule: ${INGEST_CRON}`);

  const workers = [
    createWorker<{ sourceId: string }>(QUEUE_NAMES.INGEST, async ({ sourceId }) => {
      await processIngestJob(sourceId);
    }),
    createWorker<{ articleId: string }>(QUEUE_NAMES.EMBEDDING, async ({ articleId }) => {
      await processEmbeddingJob(articleId);
    }),
    createWorker<{ trigger: "embedded-ready" }>(QUEUE_NAMES.CLUSTER, async () => {
      await processClusterJob();
    }),
    createWorker<{ clusterId: string }>(QUEUE_NAMES.SUMMARY, async ({ clusterId }) => {
      await processSummaryJob(clusterId);
    }),
    createWorker<{ clusterId: string; slug?: string }>(QUEUE_NAMES.PUBLISH, async ({ clusterId, slug }) => {
      await processPublishJob(clusterId, slug);
    }),
  ];

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      console.error(`[workers] ${worker.name} job failed`, job?.id, error.message);
    });
  }

  await enqueueEnabledSources();

  cron.schedule(INGEST_CRON, () => {
    void enqueueEnabledSources();
  });

  async function shutdown(): Promise<void> {
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error("[workers] Fatal error:", error);
  process.exit(1);
});
