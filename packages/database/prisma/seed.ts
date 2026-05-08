import { PrismaClient, SourceType } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSources = [
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    sourceType: SourceType.official_blog,
    category: "ai_research",
    trustLevel: 5,
    crawlIntervalMinutes: 30,
  },
  {
    name: "Anthropic News",
    url: "https://www.anthropic.com/news/rss.xml",
    sourceType: SourceType.official_blog,
    category: "ai_research",
    trustLevel: 5,
    crawlIntervalMinutes: 30,
  },
  {
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/discover/blog/rss.xml",
    sourceType: SourceType.official_blog,
    category: "ai_research",
    trustLevel: 5,
    crawlIntervalMinutes: 45,
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    sourceType: SourceType.official_blog,
    category: "ai_tools",
    trustLevel: 4,
    crawlIntervalMinutes: 45,
  },
  {
    name: "MIT Technology Review - AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    sourceType: SourceType.news_site,
    category: "ai_news",
    trustLevel: 4,
    crawlIntervalMinutes: 60,
  },
];

async function main(): Promise<void> {
  for (const source of defaultSources) {
    await prisma.source.upsert({
      where: { url: source.url },
      update: {
        name: source.name,
        sourceType: source.sourceType,
        category: source.category,
        trustLevel: source.trustLevel,
        crawlIntervalMinutes: source.crawlIntervalMinutes,
      },
      create: source,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
