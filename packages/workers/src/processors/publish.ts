import { prisma } from "@ai-newsroom/database";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function processPublishJob(clusterId: string, explicitSlug?: string): Promise<void> {
  const cluster = await prisma.articleCluster.findUnique({
    where: { id: clusterId },
    include: {
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      published: true,
    },
  });

  if (!cluster || cluster.published) {
    return;
  }

  const summary = cluster.summaries[0];
  if (!summary || !summary.approvedForPublish) {
    throw new Error("Cluster is not approved for publishing");
  }

  const slugBase = explicitSlug ? slugify(explicitSlug) : slugify(summary.headline);
  const slug = slugBase.length > 0 ? slugBase : `cluster-${cluster.id.slice(0, 8)}`;

  await prisma.publishedArticle.create({
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
      clusterMembers: {
        some: { clusterId: cluster.id },
      },
    },
    data: {
      status: "published",
    },
  });
}
