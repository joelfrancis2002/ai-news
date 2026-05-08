import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useArticles } from "../hooks/queries";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "fetched", label: "Fetched" },
  { value: "embedded", label: "Embedded" },
  { value: "clustered", label: "Clustered" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
  { value: "fetch_failed", label: "Failed" },
];

export function ArticlesListPage() {
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const { data, isLoading, isError } = useArticles(page, 20, status);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">Articles</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every fetched article and its current pipeline state.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setPage(1);
                setSearchParams(option.value ? { status: option.value } : {});
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === option.value
                  ? "border-blue-500 bg-blue-500/15 text-blue-300"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            Could not load articles.
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-800/70" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 py-20 text-center text-slate-500">
            No articles found.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.data.map((article) => (
                <Link
                  key={article.id}
                  to={`/articles/${article.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-blue-500/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">{article.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {article.sourceName}
                        {article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleDateString()}` : ""}
                      </p>
                      {article.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                          {article.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                      {article.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {data && data.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-sm text-slate-500">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
                  disabled={page === data.totalPages}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
