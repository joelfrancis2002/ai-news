import { Link } from "react-router-dom";
import { useClusters, useStats } from "../hooks/queries";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { data: stats } = useStats();
  const { data: clusters, isLoading, isError } = useClusters(1, 12);

  const pendingClusters = (clusters?.data ?? []).filter(
    (cluster) => cluster.reviewStatus === "unreviewed",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">Curation Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review AI-generated clusters, track pipeline health, and publish approved stories.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending review" value={stats?.articles.pending_review ?? 0} tone="text-amber-300" />
          <StatCard label="Approved" value={stats?.clusters.approved ?? 0} tone="text-emerald-300" />
          <StatCard label="Published" value={stats?.clusters.published ?? 0} tone="text-blue-300" />
          <StatCard label="Healthy sources" value={stats?.sources.healthy ?? 0} tone="text-slate-100" />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Next items to review</h2>
              <p className="text-xs text-slate-500">
                Clusters waiting for editorial approval
              </p>
            </div>
            <Link to="/clusters" className="text-sm text-blue-400 hover:text-blue-300">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-800/70" />
              ))}
            </div>
          ) : isError ? (
            <div className="px-5 py-6 text-sm text-rose-300">
              Failed to load the review queue.
            </div>
          ) : pendingClusters.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              No clusters are currently waiting for review.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {pendingClusters.map((cluster) => (
                <Link
                  key={cluster.id}
                  to={`/clusters/${cluster.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">
                        {cluster.summary?.headline ?? cluster.clusterTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {cluster.articleCount} article{cluster.articleCount === 1 ? "" : "s"} in cluster
                      </p>
                      {cluster.summary ? (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                          {cluster.summary.summary}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                      Pending
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
