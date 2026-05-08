import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type SidebarProps = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

function navClass(isActive: boolean): string {
  return `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
    isActive
      ? "bg-blue-600/15 text-blue-400"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
  }`;
}

export function Sidebar({ pendingCount, approvedCount, rejectedCount }: SidebarProps) {
  const { logout, user } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            AI
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">AI Newsroom</p>
            <p className="text-xs text-slate-500">Editorial dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Workflow
          </p>
          <NavLink to="/dashboard" className={({ isActive }) => navClass(isActive)}>
            <span>Curation Queue</span>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                {pendingCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink to="/clusters" className={({ isActive }) => navClass(isActive)}>
            <span>Clusters</span>
          </NavLink>
          <NavLink to="/articles" className={({ isActive }) => navClass(isActive)}>
            <span>Articles</span>
          </NavLink>
          <NavLink to="/summaries" className={({ isActive }) => navClass(isActive)}>
            <span>Summaries</span>
            {approvedCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                {approvedCount}
              </span>
            ) : null}
          </NavLink>
        </div>

        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Operations
          </p>
          <NavLink to="/sources" className={({ isActive }) => navClass(isActive)}>
            <span>Sources</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => navClass(isActive)}>
            <span>System</span>
            {rejectedCount > 0 ? (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                {rejectedCount}
              </span>
            ) : null}
          </NavLink>
        </div>
      </nav>

      <div className="border-t border-slate-800 px-4 py-4">
        <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
          <p className="text-sm font-medium text-slate-200">{user?.name ?? "Admin"}</p>
          <p className="text-xs text-slate-500">{user?.email ?? "admin@newsroom.ai"}</p>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-rose-500/40 hover:text-rose-300"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
