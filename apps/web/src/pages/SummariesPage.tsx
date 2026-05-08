import { useState } from "react";
import { Link } from "react-router-dom";
import { usePublished, useSummaries } from "../hooks/queries";

export function SummariesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useSummaries(page, 20);
  const { data: published } = usePublished(1, 10);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">Summaries</h1>
        <p className="mt-1 text-sm text-slate-500">
          Latest LLM-generated cluster summaries and recent published stories.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Recently published</h2>
          <div className="mt-4 space-y-2">
            {(published?.data ?? []).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
                <p className="text-sm text-slate-100">{item.headline}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(item.publishedAt).toLocaleString()}
                </p>
              </div>
            ))}
            {(published?.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Nothing has been published yet.</p>
            ) : null}
          </div>
        </section>

        {isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            Could not load summaries.
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-800/70" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 py-20 text-center text-slate-500">
            No summaries generated yet.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {data?.data.map((summary) => (
                <article key={summary.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{summary.headline}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {summary.sourceName ?? "Unknown source"} • Confidence{" "}
                        {Math.round((summary.confidenceScore ?? 0) * 100)}%
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                      {summary.approvedForPublish ? "Approved" : "Awaiting review"}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{summary.summary}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {summary.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={`/clusters/${summary.articleClusterId}`}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Open cluster
                    </Link>
                  </div>
                </article>
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
