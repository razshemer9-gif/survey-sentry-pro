import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { importWithReload } from "@/lib/dynamic-import";

// Route-level code splitting — each page loads only when visited.
// Behavior and appearance are unchanged; the Suspense fallback is the same
// spinner already shown while auth state is loading. Each import is wrapped
// so a stale chunk reference (from a tab left open across a deploy) retries
// once via a full reload instead of crashing — see dynamic-import.ts.
const Index          = lazy(() => importWithReload(() => import("./pages/Index.tsx")));
const NotFound       = lazy(() => importWithReload(() => import("./pages/NotFound.tsx")));
const ReportEditor   = lazy(() => importWithReload(() => import("./pages/ReportEditor.tsx")));
const Settings       = lazy(() => importWithReload(() => import("./pages/Settings.tsx")));
const Templates      = lazy(() => importWithReload(() => import("./pages/Templates.tsx")));
const Standards      = lazy(() => importWithReload(() => import("./pages/Standards.tsx")));
const UserManagement = lazy(() => importWithReload(() => import("./pages/UserManagement.tsx")));
const AuthPage       = lazy(() => importWithReload(() => import("./pages/AuthPage.tsx")));

const queryClient = new QueryClient();

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <HashRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/report/:id" element={<ProtectedRoute><ReportEditor /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/standards" element={<AdminRoute><Standards /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
