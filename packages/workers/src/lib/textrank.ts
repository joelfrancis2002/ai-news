/**
 * TextRank extractive summarization.
 *
 * Algorithm:
 * 1. Split text into sentences
 * 2. Represent each sentence as a TF-IDF vector
 * 3. Build a similarity graph (sentence × sentence)
 * 4. Run PageRank on the graph
 * 5. Return top-k sentences in original order
 */

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "this","that","these","those","it","its","i","we","you","he","she","they",
  "not","no","so","if","as","up","out","about","into","than","then","when",
  "there","their","what","which","who","how","all","also","more","can",
  "just","over","after","before","between","through","during","each","said",
]);

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.split(" ").length >= 5);
}

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function buildTfVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  for (const [k, v] of freq) freq.set(k, v / total);
  return freq;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of a) {
    dot += v * (b.get(k) ?? 0);
    normA += v * v;
  }
  for (const [, v] of b) normB += v * v;
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function pageRank(
  matrix: number[][],
  iterations = 30,
  damping = 0.85,
): number[] {
  const n = matrix.length;
  let scores = new Array<number>(n).fill(1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j && matrix[j][i] > 0) {
          const rowSum = matrix[j].reduce((s, v) => s + v, 0) || 1;
          newScores[i] += damping * (scores[j] * matrix[j][i]) / rowSum;
        }
      }
      newScores[i] += (1 - damping) / n;
    }
    scores = newScores;
  }

  return scores;
}

export function extractKeywords(text: string, topK = 8): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([w]) => w);
}

export function textRankSummarize(
  texts: string[],
  topK = 5,
): { summary: string; keywords: string[] } {
  const combined = texts.join(" ");
  const sentences = splitSentences(combined);

  if (sentences.length === 0) {
    return { summary: combined.slice(0, 500), keywords: extractKeywords(combined) };
  }

  if (sentences.length <= topK) {
    return {
      summary: sentences.join(" "),
      keywords: extractKeywords(combined),
    };
  }

  const vectors = sentences.map((s) => buildTfVector(tokenize(s)));

  // Build similarity matrix
  const n = sentences.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = cosineSim(vectors[i], vectors[j]);
      }
    }
  }

  const scores = pageRank(matrix);

  // Pick top-k sentences, preserve original order
  const ranked = scores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.idx - b.idx);

  const summary = ranked.map(({ idx }) => sentences[idx]).join(" ");
  const keywords = extractKeywords(combined);

  return { summary, keywords };
}
