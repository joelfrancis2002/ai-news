import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { ToastContainer } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { useStats } from "./hooks/queries";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";
import { ArticlesListPage } from "./pages/ArticlesListPage";
import { ClusterDetailPage } from "./pages/ClusterDetailPage";
import { ClustersPage } from "./pages/ClustersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";
import { SummariesPage } from "./pages/SummariesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data } = useStats();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar
        pendingCount={data?.articles.pending_review ?? 0}
        approvedCount={data?.clusters.approved ?? 0}
        rejectedCount={data?.clusters.rejected ?? 0}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  useAuth();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/clusters" element={<Protected><ClustersPage /></Protected>} />
        <Route path="/clusters/:id" element={<Protected><ClusterDetailPage /></Protected>} />
        <Route path="/articles" element={<Protected><ArticlesListPage /></Protected>} />
        <Route path="/articles/:id" element={<Protected><ArticleDetailPage /></Protected>} />
        <Route path="/summaries" element={<Protected><SummariesPage /></Protected>} />
        <Route path="/sources" element={<Protected><SourcesPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <Toaster position="bottom-right" />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
