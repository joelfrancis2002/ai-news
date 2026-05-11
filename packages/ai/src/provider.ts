import type {
  FactCheckStatus,
  LlmSummaryInput,
  LlmSummaryOutput,
} from "@ai-newsroom/shared";

export type AiProviderId = "openai" | "gemini";

export interface AiProvider {
  readonly id: AiProviderId;
  summarizeCluster(input: LlmSummaryInput): Promise<LlmSummaryOutput>;
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_FACT_STATUS: FactCheckStatus = "unverified";

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.6;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function normalizeFactStatus(value: unknown): FactCheckStatus {
  const allowed: FactCheckStatus[] = [
    "verified",
    "likely_true",
    "partially_verified",
    "unverified",
    "disputed",
    "low_quality",
  ];
  if (typeof value === "string" && allowed.includes(value as FactCheckStatus)) {
    return value as FactCheckStatus;
  }
  return DEFAULT_FACT_STATUS;
}

function validateSummaryOutput(value: JsonRecord): LlmSummaryOutput {
  const headline =
    typeof value.headline === "string" && value.headline.trim().length > 0
      ? value.headline.trim()
      : "AI News Summary";

  const summary =
    typeof value.summary === "string" && value.summary.trim().length > 0
      ? value.summary.trim()
      : "Summary unavailable.";

  return {
    headline,
    summary,
    keywords: normalizeKeywords(value.keywords),
    confidenceScore: clampConfidence(value.confidenceScore),
    factCheckStatus: normalizeFactStatus(value.factCheckStatus),
  };
}

function buildPrompt(input: LlmSummaryInput): { system: string; user: string } {
  const systemPrompt = `You are an expert, impartial Executive News Editor and Lead Fact-Checker for an automated newsroom.

Your task is to analyze a "cluster" of raw news articles that are supposedly about the same topic, synthesize their information into a single cohesive report, and rigorously fact-check the claims across the different sources.

INPUT:
You will receive a JSON array containing multiple articles. Each article includes a "title", "sourceName", "description", and raw "content".

OUTPUT REQUIREMENT:
You must return a single, strictly valid JSON object. Do not include any markdown formatting blocks (like \`\`\`json), conversational text, or explanations outside the JSON object. The JSON must exactly match the following schema:

{
  "headline": "string",
  "summary": "string",
  "keywords": ["string", "string", ...],
  "factCheckStatus": "enum",
  "confidenceScore": float
}

DETAILED GUIDELINES FOR EACH FIELD:

1. "headline" (String)
- Create a clear, objective, and engaging headline (max 80 characters).
- Avoid clickbait, sensationalism, or opinion.
- Summarize the core event or consensus of the cluster.

2. "summary" (String)
- Write a concise, journalistic summary (3 to 5 sentences).
- Start with the most important facts (the "bottom line up front").
- If sources disagree on specific details, explicitly state the discrepancy (e.g., "While Source A reports X, Source B claims Y").
- Do not introduce outside knowledge; rely ONLY on the provided article texts.

3. "keywords" (Array of Strings)
- Extract 5 to 8 highly relevant keywords or keyphrases.
- Include primary entities (people, companies, technologies, locations).

4. "factCheckStatus" (String Enum)
You must select EXACTLY ONE of the following precise strings based on cross-referencing the sources:
- "verified": Multiple independent sources report the exact same core facts with high detail.
- "likely_true": Most sources agree on the core facts, but minor details (like exact numbers or quotes) vary slightly.
- "partially_verified": The core event occurred, but significant specific claims within the articles lack cross-corroboration.
- "unverified": Only a single source is reporting the event, or the reports are based entirely on anonymous rumors without evidence.
- "disputed": The sources fundamentally contradict each other on the core facts of the story.
- "low_quality": The provided articles are mostly opinion, editorialized, clickbait, or lack concrete factual statements.

5. "confidenceScore" (Float)
- Provide a decimal number between 0.00 and 1.00.
- 0.90 to 1.00: Perfect alignment across multiple high-quality sources.
- 0.70 to 0.89: General agreement, minor discrepancies.
- 0.40 to 0.69: Partial information, single-source reliance, or noticeable contradictions.
- 0.00 to 0.39: Highly contradictory, speculative, or useless data.`;

  const userMessage = JSON.stringify({
    clusterTitle: input.clusterTitle,
    articles: input.articles.map(a => ({
      title: a.title,
      sourceName: a.sourceName,
      description: a.description,
      content: (a.content ?? "").slice(0, 2500) // Truncate if too long
    }))
  });

  return { system: systemPrompt, user: userMessage };
}

function extractJsonObject(text: string): JsonRecord {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as JsonRecord;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as JsonRecord;
    }
    throw new Error("Model did not return valid JSON");
  }
}

class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;

  constructor(private readonly apiKey: string) {}

  async summarizeCluster(input: LlmSummaryInput): Promise<LlmSummaryOutput> {
    const prompt = buildPrompt(input);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt.system,
          },
          {
            role: "user",
            content: prompt.user,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned no content");
    }

    return validateSummaryOutput(extractJsonObject(content));
  }
}

class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;

  constructor(private readonly apiKey: string) {}

  async summarizeCluster(input: LlmSummaryInput): Promise<LlmSummaryOutput> {
    const prompt = buildPrompt(input);
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `${prompt.system}\n\n${prompt.user}` }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("Gemini returned no content");
    }

    return validateSummaryOutput(extractJsonObject(content));
  }
}

export function createAiProviderFromEnv(): AiProvider | null {
  const id = process.env.AI_PROVIDER as AiProviderId | undefined;
  if (id === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAiProvider(process.env.OPENAI_API_KEY);
  }
  if (id === "gemini" && process.env.GEMINI_API_KEY) {
    return new GeminiProvider(process.env.GEMINI_API_KEY);
  }
  return null;
}
