import { prisma } from "@ai-newsroom/database";
import { createAiProviderFromEnv } from "@ai-newsroom/ai";
import type { LlmSummaryOutput } from "@ai-newsroom/shared";
import { textRankSummarize } from "../lib/textrank.js";

function fallbackSummary(
  clusterTitle: string,
  texts: string[],
  articleCount: number,
): LlmSummaryOutput {
  const { summary, keywords } = textRankSummarize(texts, 5);
  return {
    headline: clusterTitle || "AI News Summary",
    summary,
    keywords,
    confidenceScore: Math.min(0.45 + articleCount * 0.08, 0.9),
    factCheckStatus: articleCount >= 3 ? "likely_true" : "unverified",
  };
}

export async function processSummaryJob(clusterId: string): Promise<void> {
  const cluster = await prisma.articleCluster.findUnique({
    where: { id: clusterId },
    include: {
      members: {
        include: {
          article: {
            include: {
              source: {
                select: { name: true },
              },
            },
          },
        },
      },
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!cluster || cluster.summaries.length > 0) {
    return;
  }

  const articles = cluster.members.map((member) => member.article);
  if (articles.length === 0) {
    return;
  }

  const texts = articles.map((article) =>
    [article.title, article.description ?? "", (article.content ?? "").slice(0, 2500)]
      .filter(Boolean)
      .join(". "),
  );

  const provider = createAiProviderFromEnv();

  let result: LlmSummaryOutput;
  if (provider) {
    try {
      result = await provider.summarizeCluster({
        clusterTitle: cluster.clusterTitle,
        articles: articles.map((article) => ({
          title: article.title,
          description: article.description,
          content: article.content,
          sourceName: article.source.name,
          originalUrl: article.originalUrl,
        })),
      });
    } catch {
      result = fallbackSummary(cluster.clusterTitle, texts, articles.length);
    }
  } else {
    result = fallbackSummary(cluster.clusterTitle, texts, articles.length);
  }

  const primaryArticle = articles[0];
  const imageUrl = articles.find((article) => article.imageUrl)?.imageUrl ?? null;

  await prisma.summary.create({
    data: {
      articleClusterId: cluster.id,
      headline: result.headline,
      summary: result.summary,
      keywords: result.keywords,
      imageUrl,
      sourceUrl: primaryArticle.originalUrl,
      sourceName: primaryArticle.source.name,
      confidenceScore: result.confidenceScore,
      factCheckStatus: result.factCheckStatus,
    },
  });

  await prisma.rawArticle.updateMany({
    where: {
      id: { in: articles.map((article) => article.id) },
    },
    data: {
      status: "pending_review",
    },
  });

  await prisma.articleCluster.update({
    where: { id: cluster.id },
    data: {
      confidenceScore: result.confidenceScore,
      factCheckStatus: result.factCheckStatus,
      updatedAt: new Date(),
    },
  });
}
