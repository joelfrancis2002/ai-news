import type { Article } from "../types";

type ArticleCardProps = {
  article: Article;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function ArticleCard({
  article,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onDelete,
}: ArticleCardProps) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(article.id)}
          className="mt-1 h-4 w-4"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">{article.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {article.sourceName} • {article.status}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {onApprove ? (
          <button
            onClick={() => onApprove(article.id)}
            className="rounded-lg bg-emerald-600/20 px-3 py-1 text-xs text-emerald-300"
          >
            Approve
          </button>
        ) : null}
        {onReject ? (
          <button
            onClick={() => onReject(article.id)}
            className="rounded-lg bg-rose-600/20 px-3 py-1 text-xs text-rose-300"
          >
            Reject
          </button>
        ) : null}
        {onDelete ? (
          <button
            onClick={() => onDelete(article.id)}
            className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300"
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
