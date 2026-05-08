export type {
  ArticleRecord as Article,
  SourceRecord as Source,
  SourceType,
} from "@ai-newsroom/shared";

export type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};
