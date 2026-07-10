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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/v/:shortCode" element={<PublicLeadForm />} />
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
          <Route path="qr-codes" element={<QrCodesPage />} />
          <Route path="forms" element={<FormBuilderPage />} />
          <Route path="scan" element={<OcrScanPage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}
