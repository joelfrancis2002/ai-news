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

function buildPrompt(input: LlmSummaryInput): string {
  const articleLines = input.articles
    .map(
      (article, index) =>
        [
          `Article ${index + 1}:`,
          `Title: ${article.title}`,
          `Source: ${article.sourceName}`,
          `URL: ${article.originalUrl}`,
          `Description: ${article.description ?? ""}`,
          `Content: ${(article.content ?? "").slice(0, 2500)}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    "You summarize grouped AI news articles for an editorial dashboard.",
    "Return strict JSON with this shape:",
    '{"headline":"string","summary":"string","keywords":["string"],"confidenceScore":0.0,"factCheckStatus":"verified|likely_true|partially_verified|unverified|disputed|low_quality"}',
    "Rules:",
    "- Keep the summary factual and concise.",
    "- Use only the supplied article information.",
    "- confidenceScore must be between 0 and 1.",
    "- factCheckStatus should reflect evidence quality, not certainty beyond the articles.",
    `Cluster title: ${input.clusterTitle}`,
    "",
    articleLines,
  ].join("\n");
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a careful AI news editor that returns JSON only.",
          },
          {
            role: "user",
            content: buildPrompt(input),
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
              parts: [{ text: buildPrompt(input) }],
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
