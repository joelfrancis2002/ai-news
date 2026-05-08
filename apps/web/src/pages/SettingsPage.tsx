import { useHealth, useStats } from "../hooks/queries";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-200">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="divide-y divide-slate-800/70">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { data: health } = useHealth();
  const { data: stats } = useStats();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">System Status</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live API, queue, and pipeline overview for the MVP runtime.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Section title="API">
          <Row label="Status" value={health?.status ?? "offline"} />
          <Row label="Service" value={health?.service ?? "unknown"} />
          <Row label="Timestamp" value={health?.timestamp ?? "unavailable"} />
        </Section>

        <Section title="Pipeline">
          <Row label="Mode" value={stats?.pipeline.queueMode ?? "unknown"} />
          <Row label="Schedule" value={stats?.pipeline.schedule ?? "unknown"} />
          <Row label="Ingest waiting" value={String(stats?.pipeline.queues.ingest.waiting ?? 0)} />
          <Row label="Embedding waiting" value={String(stats?.pipeline.queues.embedding.waiting ?? 0)} />
          <Row label="Cluster waiting" value={String(stats?.pipeline.queues.cluster.waiting ?? 0)} />
          <Row label="Summary waiting" value={String(stats?.pipeline.queues.summary.waiting ?? 0)} />
        </Section>

        <Section title="Database state">
          <Row label="Articles total" value={String(stats?.articles.total ?? 0)} />
          <Row label="Pending review" value={String(stats?.articles.pending_review ?? 0)} />
          <Row label="Published" value={String(stats?.articles.published ?? 0)} />
          <Row label="Clusters total" value={String(stats?.clusters.total ?? 0)} />
          <Row label="Sources total" value={String(stats?.sources.total ?? 0)} />
          <Row label="Healthy sources" value={String(stats?.sources.healthy ?? 0)} />
        </Section>
      </div>
    </div>
  );
}
