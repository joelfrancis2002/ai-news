import { prisma } from "@ai-newsroom/database";
import { computeEmbedding } from "../lib/embedding.js";
// import { enqueueClusterSweep } from "../queues.js";

export async function processEmbeddingJob(articleId: string): Promise<void> {
  const article = await prisma.rawArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      status: true,
    },
  });

  if (!article || article.status !== "fetched") {
    return;
  }

  const text = [
    article.title,
    article.title,
    article.description ?? "",
    article.description ?? "",
    (article.content ?? "").slice(0, 4000),
  ]
    .join(" ")
    .trim();

  if (!text) {
    await prisma.rawArticle.update({
      where: { id: article.id },
      data: { status: "fetch_failed" },
    });
    return;
  }

  const embedding = computeEmbedding(text);

  await prisma.rawArticle.update({
    where: { id: article.id },
    data: {
      embedding,
      status: "embedded",
    },
  });

  // In direct mode, clustering is done immediately after embedding
  // await enqueueClusterSweep();
}
