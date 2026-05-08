import { Link, useParams } from "react-router-dom";
import { useArticle } from "../hooks/queries";

export function ArticleDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data: article, isLoading, isError } = useArticle(id);

  if (isLoading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Loading article...</div>;
  }

  if (isError || !article) {
    return <div className="px-6 py-6 text-sm text-rose-300">Article not found.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <Link to="/articles" className="text-xs text-slate-500 hover:text-slate-300">
          Back to articles
        </Link>
        <p className="mt-2 text-xs text-slate-500">
          {article.sourceName}
          {article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleString()}` : ""}
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">{article.title}</h1>
        <a
          href={article.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          Open original article
        </a>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {article.description ? (
          <p className="mb-5 text-base text-slate-300">{article.description}</p>
        ) : null}

        {article.content ? (
          <div className="space-y-4">
            {article.content
              .split("\n")
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="text-sm leading-7 text-slate-400">
                  {paragraph}
                </p>
              ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
            Full extracted content is not available for this article.
          </div>
        )}
      </div>
    </div>
  );
}
