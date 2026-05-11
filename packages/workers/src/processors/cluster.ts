import { prisma } from "@ai-newsroom/database";
// import { getSummaryQueue } from "../queues.js";
import { cosineSimilarity } from "../lib/embedding.js";

const EPSILON = 0.35;
const MIN_POINTS = 2;

type EmbeddedArticle = {
  id: string;
  title: string;
  embedding: number[];
};

function dbscan(embeddings: number[][], epsilon: number, minPts: number): number[] {
  const labels = new Array<number>(embeddings.length).fill(-2);
  let clusterId = 0;

  function distance(i: number, j: number): number {
    return 1 - cosineSimilarity(embeddings[i], embeddings[j]);
  }

  function neighbors(index: number): number[] {
    const result: number[] = [];
    for (let j = 0; j < embeddings.length; j++) {
      if (j !== index && distance(index, j) <= epsilon) {
        result.push(j);
      }
    }
    return result;
  }

  function expand(index: number, currentNeighbors: number[], nextClusterId: number): void {
    labels[index] = nextClusterId;
    let cursor = 0;
    while (cursor < currentNeighbors.length) {
      const neighbor = currentNeighbors[cursor];
      if (labels[neighbor] === -1) {
        labels[neighbor] = nextClusterId;
      }
      if (labels[neighbor] !== -2) {
        cursor++;
        continue;
      }
      labels[neighbor] = nextClusterId;
      const neighborNeighbors = neighbors(neighbor);
      if (neighborNeighbors.length >= minPts) {
        for (const candidate of neighborNeighbors) {
          if (!currentNeighbors.includes(candidate)) {
            currentNeighbors.push(candidate);
          }
        }
      }
      cursor++;
    }
  }

  for (let i = 0; i < embeddings.length; i++) {
    if (labels[i] !== -2) {
      continue;
    }

    const currentNeighbors = neighbors(i);
    if (currentNeighbors.length < minPts) {
      labels[i] = -1;
      continue;
    }

    expand(i, currentNeighbors, clusterId);
    clusterId++;
  }

  return labels;
}

function deriveClusterTitle(members: EmbeddedArticle[]): string {
  const frequencies = new Map<string, number>();
  for (const member of members) {
    for (const token of member.title.toLowerCase().split(/\s+/)) {
      if (token.length <= 4) {
        continue;
      }
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
  }

  const topWords = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  return topWords.length > 0 ? topWords.join(" ") : members[0].title.slice(0, 80);
}

export async function processClusterJob(): Promise<void> {
  const articles = await prisma.rawArticle.findMany({
    where: {
      status: "embedded",
      embedding: { isEmpty: false },
    },
    select: {
      id: true,
      title: true,
      embedding: true,
    },
  });

  if (articles.length === 0) {
    return;
  }

  const labels = dbscan(
    articles.map((article) => article.embedding),
    EPSILON,
    MIN_POINTS,
  );

  const groups = new Map<string, EmbeddedArticle[]>();
  for (const [index, article] of articles.entries()) {
    const label = labels[index];
    const key = label === -1 ? `singleton:${article.id}` : `cluster:${label}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(article);
    groups.set(key, bucket);
  }

  for (const members of groups.values()) {
    const cluster = await prisma.articleCluster.create({
      data: {
        clusterTitle: deriveClusterTitle(members),
        members: {
          create: members.map((member) => ({ articleId: member.id })),
        },
      },
      select: { id: true },
    });

    await prisma.rawArticle.updateMany({
      where: { id: { in: members.map((member) => member.id) } },
      data: {
        status: "clustered",
      },
    });

    // In direct mode, summaries are generated immediately after clustering
    // await getSummaryQueue().add(
    //   "summarize-cluster",
    //   { clusterId: cluster.id },
    //   { jobId: `summary:${cluster.id}` },
    // );
  }
}
