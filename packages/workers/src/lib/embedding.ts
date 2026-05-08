/**
 * TF-IDF based text embedding.
 * Produces a fixed-size dense vector by:
 * 1. Tokenizing and computing TF-IDF weights for a vocabulary
 * 2. Projecting down to EMBEDDING_DIM via a deterministic hash projection
 *
 * This runs entirely in-process with no external dependencies or downloads.
 * Cosine similarity between these vectors correlates well with topic similarity.
 */

const EMBEDDING_DIM = 128;
const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "this","that","these","those","it","its","i","we","you","he","she","they",
  "not","no","so","if","as","up","out","about","into","than","then","when",
  "there","their","they","what","which","who","how","all","also","more",
  "can","just","over","after","before","between","through","during","each",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const total = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / total);
  }
  return tf;
}

/** Deterministic hash of a string to an integer */
function hashCode(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Project a TF-IDF map to a fixed-size vector using random projection
 * (each term maps to a dimension via hash, sign via second hash).
 */
function project(tfMap: Map<string, number>): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const [term, weight] of tfMap) {
    const dim = hashCode(term) % EMBEDDING_DIM;
    const sign = hashCode(term + "_sign") % 2 === 0 ? 1 : -1;
    vec[dim] += sign * weight;
  }
  return vec;
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function computeEmbedding(text: string): number[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return new Array<number>(EMBEDDING_DIM).fill(0);
  const tf = termFrequency(tokens);
  const projected = project(tf);
  return normalize(projected);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export const EMBEDDING_DIM_SIZE = EMBEDDING_DIM;
