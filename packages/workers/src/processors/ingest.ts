import Parser from "rss-parser";
import axios from "axios";
import { extract } from "@extractus/article-extractor";
import { prisma } from "@ai-newsroom/database";
// import { getEmbeddingQueue } from "../queues.js";

const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "AI-Newsroom-Bot/1.0" },
});

async function fetchFullContent(url: string): Promise<string | null> {
  try {
    const article = await extract(url);
    if (article?.content) {
      return article.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  } catch {
    // Fallback to raw HTML extraction below.
  }

  try {
    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: { "User-Agent": "AI-Newsroom-Bot/1.0" },
      responseType: "text",
    });

    return response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
  } catch {
    return null;
  }
}

export async function processIngestJob(sourceId: string): Promise<void> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
  });

  if (!source || !source.enabled) {
    return;
  }

  let feed: Parser.Output<Parser.Item>;
  try {
    feed = await rssParser.parseURL(source.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCrawledAt: new Date(),
        lastFailureAt: new Date(),
        lastError: message,
      },
    });
    throw new Error(`RSS fetch failed for ${source.name}: ${message}`);
  }

  const insertedArticleIds: string[] = [];

  for (const item of feed.items.slice(0, 25)) {
    const url = item.link?.trim();
    const title = item.title?.trim();

    if (!url || !title) {
      continue;
    }

    const existing = await prisma.rawArticle.findUnique({
      where: { originalUrl: url },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const content = await fetchFullContent(url);
    const enclosure = item.enclosure as { url?: string } | undefined;
    const publishedAt = item.isoDate ? new Date(item.isoDate) : null;

    const article = await prisma.rawArticle.create({
      data: {
        sourceId: source.id,
        originalUrl: url,
        canonicalUrl: url,
        title,
        description: item.contentSnippet ?? item.content ?? null,
        content,
        author: item.creator ?? null,
        publishedAt,
        imageUrl: enclosure?.url ?? null,
        rawJson: item as unknown as object,
        status: "fetched",
        embedding: [],
      },
      select: { id: true },
    });

    insertedArticleIds.push(article.id);
  }

  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastCrawledAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
    },
  });

  // In direct mode, embeddings are processed immediately after ingest
  // await Promise.all(
  //   insertedArticleIds.map((articleId) =>
  //     getEmbeddingQueue().add("embed-article", { articleId }, { jobId: `embed:${articleId}` }),
  //   ),
  // );
}
