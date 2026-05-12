import { useState } from "react";
import { useCreateSource, useDeleteSource, useSources, useUpdateSource } from "../hooks/queries";
import type { SourceType } from "../lib/api";

const SOURCE_TYPES: SourceType[] = [
  "rss",
  "official_blog",
  "news_site",
  "research_feed",
  "github_release",
  "manual",
];

export function SourcesPage() {
  const { data, isLoading, isError } = useSources(1, 100);
  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("rss");

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await createSource.mutateAsync({
      name,
      url,
      sourceType,
    });
    setName("");
    setUrl("");
    setSourceType("rss");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-100">Sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage RSS feeds and source health for the ingestion pipeline.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-200">Add source</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Source name"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/feed.xml"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 md:col-span-2"
            />
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceType)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={createSource.isPending}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Add source
          </button>
        </form>

        {isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            Could not load sources.
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Source registry</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-800/70" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {data?.data.map((source) => (
                <div key={source.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{source.name}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{source.url}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {source.sourceType.replace(/_/g, " ")} • every {source.crawlIntervalMinutes} min
                    </p>
                    {source.lastError ? (
                      <p className="mt-1 text-xs text-rose-300">{source.lastError}</p>
                    ) : null}
                  </div>

                  <button
                    onClick={() =>
                      updateSource.mutate({
                        id: source.id,
                        payload: { enabled: !source.enabled },
                      })
                    }
                    className={`rounded-lg px-3 py-2 text-sm ${
                      source.enabled
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {source.enabled ? "Enabled" : "Disabled"}
                  </button>

                  <button
                    onClick={() => deleteSource.mutate(source.id)}
                    className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {(data?.data.length ?? 0) === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">No sources added yet.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
