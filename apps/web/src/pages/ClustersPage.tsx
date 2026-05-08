import { useState } from "react";
import { Link } from "react-router-dom";
import { useClusters } from "../hooks/queries";

function reviewBadge(reviewStatus: "unreviewed" | "approved" | "rejected"): string {
  if (reviewStatus === "approved") {
    return "bg-emerald-500/15 text-emerald-300";
  }
  if (reviewStatus === "rejected") {
    return "bg-rose-500/15 text-rose-300";
  }
  return "bg-amber-500/15 text-amber-300";
}

export function ClustersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useClusters(page, 18);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">Article Clusters</h1>
        <p className="mt-1 text-sm text-slate-500">
          Story groups produced by the ingestion, embedding, clustering, and summary pipeline.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            Could not load clusters.
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-xl bg-slate-800/70" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 py-20 text-center text-slate-500">
            No clusters available yet.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data?.data.map((cluster) => (
                <Link
                  key={cluster.id}
                  to={`/clusters/${cluster.id}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-blue-500/40 hover:bg-slate-900/80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">
                        {cluster.summary?.headline ?? cluster.clusterTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {cluster.articleCount} article{cluster.articleCount === 1 ? "" : "s"} in cluster
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${reviewBadge(cluster.reviewStatus)}`}>
                      {cluster.reviewStatus.replace("_", " ")}
                    </span>
                  </div>
                  {cluster.summary ? (
                    <p className="mt-3 line-clamp-4 text-sm text-slate-400">
                      {cluster.summary.summary}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Summary not generated yet.</p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Confidence {Math.round(cluster.confidenceScore * 100)}%
                    </span>
                    <span>{cluster.factCheckStatus.replace(/_/g, " ")}</span>
                  </div>
                </Link>
              ))}
            </div>

            {data && data.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-2">
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
