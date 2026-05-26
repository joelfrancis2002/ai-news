import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAddReview, useCluster, usePublishCluster } from "../hooks/queries";
import { useAuth } from "../context/AuthContext";

export function ClusterDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data: cluster, isLoading, isError } = useCluster(id);
  const reviewMutation = useAddReview(id);
  const publishMutation = usePublishCluster(id);
  const { user } = useAuth();
  const isReader = user?.userType === "reader";
  const [notes, setNotes] = useState("");

  if (isLoading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Loading cluster...</div>;
  }

  if (isError || !cluster) {
    return (
      <div className="px-6 py-6 text-sm text-rose-300">
        Cluster not found or the API is unavailable.
      </div>
    );
  }

  const canPublish = Boolean(cluster.summary?.approvedForPublish) && !cluster.published;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <Link to="/clusters" className="text-xs text-slate-500 hover:text-slate-300">
          Back to clusters
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">
          {cluster.summary?.headline ?? cluster.clusterTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {cluster.articleCount} article{cluster.articleCount === 1 ? "" : "s"} • Confidence{" "}
          {Math.round(cluster.confidenceScore * 100)}%
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {cluster.summary ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-blue-400">AI Summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{cluster.summary.summary}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                {cluster.factCheckStatus.replace(/_/g, " ")}
              </div>
            </div>
            {cluster.summary.keywords.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {cluster.summary.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {!isReader && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Review notes
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                  placeholder="Why is this cluster approved or rejected?"
                />
              </div>
              <button
                onClick={() => reviewMutation.mutate({ decision: "approve", notes })}
                disabled={reviewMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={() => reviewMutation.mutate({ decision: "reject", notes })}
                disabled={reviewMutation.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Reject
              </button>
              <button
                onClick={() => publishMutation.mutate(undefined)}
                disabled={!canPublish || publishMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {cluster.published ? "Published" : "Publish"}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Articles in cluster</h2>
          </div>
          <div className="divide-y divide-slate-800/70">
            {cluster.articles.map((article) => (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="block px-5 py-4 transition-colors hover:bg-slate-800/40"
              >
                <p className="text-sm font-medium text-slate-100">{article.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {article.sourceName} • {article.status}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Review history</h2>
          </div>
          {cluster.reviews.length === 0 ? (
            <div className="px-5 py-5 text-sm text-slate-500">No review actions yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {cluster.reviews.map((review) => (
                <div key={review.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-200">
                      {review.decision === "approve" ? "Approved" : "Rejected"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(review.decidedAt).toLocaleString()}
                    </p>
                  </div>
                  {review.notes ? (
                    <p className="mt-2 text-sm text-slate-400">{review.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
