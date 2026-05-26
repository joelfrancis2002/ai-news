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
      ? "bg-blue-600/15 text-blue-400 font-medium"
      : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
  }`;
}

export function Sidebar({ pendingCount, approvedCount, rejectedCount }: SidebarProps) {
  const { logout, user } = useAuth();
  const isReader = user?.userType === "reader";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950 font-sans">
      {/* Brand Logo Header */}
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
            AI
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-100">AI Newsroom</p>
            <p className="text-xs text-slate-500">{isReader ? "Reader Portal" : "Editorial Dashboard"}</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-6 px-3 py-6 overflow-y-auto">
        {/* Workspace Section */}
        <div className="space-y-1.5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Workspace
          </p>
          {!isReader && (
            <NavLink to="/dashboard" className={({ isActive }) => navClass(isActive)}>
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                </svg>
                <span>Overview</span>
              </div>
            </NavLink>
          )}

          <NavLink to="/clusters" className={({ isActive }) => navClass(isActive)}>
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2m2 2h-2m2 0v10a2 2 0 01-2 2h-2M9 7h6m-6 4h6m-6 4h6" />
              </svg>
              <span>{isReader ? "Published News" : "News Room"}</span>
            </div>
            {!isReader && pendingCount > 0 ? (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                {pendingCount}
              </span>
            ) : null}
          </NavLink>

          {!isReader && (
            <NavLink to="/articles" className={({ isActive }) => navClass(isActive)}>
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <span>Incoming Feeds</span>
              </div>
            </NavLink>
          )}

          <NavLink to="/summaries" className={({ isActive }) => navClass(isActive)}>
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>{isReader ? "AI Summaries" : "AI Briefings"}</span>
            </div>
            {!isReader && approvedCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                {approvedCount}
              </span>
            ) : null}
          </NavLink>
        </div>

        {/* Configurations Section */}
        <div className="space-y-1.5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            {isReader ? "Information" : "Operations"}
          </p>
          <NavLink to="/sources" className={({ isActive }) => navClass(isActive)}>
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>{isReader ? "Active Sources" : "Feed Sources"}</span>
            </div>
          </NavLink>
          {!isReader && (
            <NavLink to="/settings" className={({ isActive }) => navClass(isActive)}>
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>System Status</span>
              </div>
            </NavLink>
          )}
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-800 px-4 py-4 space-y-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-200 truncate">{user?.name ?? "Admin"}</p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">{user?.email ?? "admin@newsroom.ai"}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-rose-500/35 hover:text-rose-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
