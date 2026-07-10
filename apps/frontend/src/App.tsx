import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./stores/auth.store";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/Dashboard";
import { LeadsPage } from "./pages/Leads";
import { LeadDetailPage } from "./pages/LeadDetail";
import { QrCodesPage } from "./pages/QrCodes";
import { FormBuilderPage } from "./pages/FormBuilder";
import { OcrScanPage } from "./pages/OcrScan";
import { SyncPage } from "./pages/Sync";
import { AuditLogPage } from "./pages/AuditLog";
import { UsersPage } from "./pages/Users";
import { PublicLeadForm } from "./pages/PublicLeadForm";
import { WebsiteRoastPage } from "./pages/WebsiteRoast";
import { AnalysisHistoryPage } from "./pages/AnalysisHistory";
import { AnalysisReportPage } from "./pages/AnalysisReport";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Blocks direct-URL access to routes above the user's role (defense in depth —
// the sidebar hides them and the backend also enforces the same roles).
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const ADMIN = ["ADMIN", "SUPER_ADMIN"];

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/v/:shortCode" element={<PublicLeadForm />} />
        <Route path="/ai/report/:id" element={<AnalysisReportPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="scan" element={<OcrScanPage />} />
          <Route path="ai/roast" element={<WebsiteRoastPage />} />
          <Route path="ai/history" element={<AnalysisHistoryPage />} />
          <Route path="qr-codes" element={<RequireRole roles={ADMIN}><QrCodesPage /></RequireRole>} />
          <Route path="forms" element={<RequireRole roles={ADMIN}><FormBuilderPage /></RequireRole>} />
          <Route path="sync" element={<RequireRole roles={ADMIN}><SyncPage /></RequireRole>} />
          <Route path="audit" element={<RequireRole roles={ADMIN}><AuditLogPage /></RequireRole>} />
          <Route path="users" element={<RequireRole roles={["SUPER_ADMIN"]}><UsersPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
