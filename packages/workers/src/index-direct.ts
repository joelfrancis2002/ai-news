import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import cron from "node-cron";
import { prisma } from "@ai-newsroom/database";
import { processIngestJob } from "./processors/ingest.js";
import { processEmbeddingJob } from "./processors/embedding.js";
import { processClusterJob } from "./processors/cluster.js";
import { processSummaryJob } from "./processors/summary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const INGEST_CRON = process.env.INGEST_CRON ?? "*/15 * * * *";

async function runDirectPipeline(): Promise<void> {
  console.log("[workers] Starting direct pipeline (no Redis)");
  console.log(`[workers] Schedule: ${INGEST_CRON}`);

  async function runPipeline(): Promise<void> {
    try {
      console.log("[workers] Running pipeline...");
      
      // Step 1: Ingest articles
      const sources = await prisma.source.findMany({
        where: { enabled: true },
        select: { id: true },
      });

      console.log(`[workers] Processing ${sources.length} sources...`);
      
      for (const source of sources) {
        try {
          await processIngestJob(source.id);
        } catch (error) {
          console.error(`[workers] Failed to ingest source ${source.id}:`, error);
        }
      }

      // Step 2: Process embeddings
      const articlesToEmbed = await prisma.rawArticle.findMany({
        where: { status: "fetched" },
        select: { id: true },
        take: 50, // Limit to prevent overwhelming
      });

      console.log(`[workers] Processing embeddings for ${articlesToEmbed.length} articles...`);
      
      for (const article of articlesToEmbed) {
        try {
          await processEmbeddingJob(article.id);
        } catch (error) {
          console.error(`[workers] Failed to embed article ${article.id}:`, error);
        }
      }

      // Step 3: Cluster articles
      try {
        await processClusterJob();
        console.log("[workers] Clustering completed");
      } catch (error) {
        console.error("[workers] Failed to cluster articles:", error);
      }

      // Step 4: Generate summaries
      const clustersToSummarize = await prisma.articleCluster.findMany({
        where: {
          summaries: {
            none: {}
          }
        },
        select: { id: true },
        take: 20,
      });

      console.log(`[workers] Generating summaries for ${clustersToSummarize.length} clusters...`);
      
      for (const cluster of clustersToSummarize) {
        try {
          await processSummaryJob(cluster.id);
        } catch (error) {
          console.error(`[workers] Failed to summarize cluster ${cluster.id}:`, error);
        }
      }

      console.log("[workers] Pipeline completed successfully");
    } catch (error) {
      console.error("[workers] Pipeline failed:", error);
    }
  }

  // Run immediately on start
  await runPipeline();

  // Schedule regular runs
  cron.schedule(INGEST_CRON, () => {
    void runPipeline();
  });

  console.log("[workers] Direct pipeline scheduler started");

  async function shutdown(): Promise<void> {
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

async function main(): Promise<void> {
  await runDirectPipeline();
}
