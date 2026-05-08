export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-slate-700" />
          <div className="h-5 w-3/4 rounded bg-slate-700" />
          <div className="h-5 w-1/2 rounded bg-slate-700" />
        </div>
        <div className="h-6 w-20 rounded-full bg-slate-700" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-800" />
        <div className="h-3 w-5/6 rounded bg-slate-800" />
        <div className="h-3 w-4/6 rounded bg-slate-800" />
      </div>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
        <div className="h-3 w-20 rounded bg-slate-700" />
        <div className="h-3 w-full rounded bg-slate-800" />
        <div className="h-3 w-3/4 rounded bg-slate-800" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-3 w-32 rounded bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-slate-700" />
          <div className="h-8 w-20 rounded-lg bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
