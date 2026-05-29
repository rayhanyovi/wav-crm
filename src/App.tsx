import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { LeadDetailPage } from "@/pages/LeadDetailPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { ContactDetailPage } from "@/pages/ContactDetailPage";
import { CompaniesPage } from "@/pages/CompaniesPage";
import { CompanyDetailPage } from "@/pages/CompanyDetailPage";
import { ActivitiesPage } from "@/pages/ActivitiesPage";
import { ActivityDetailPage } from "@/pages/ActivityDetailPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { TeamPage } from "@/pages/TeamPage";
import { AdvisorPerformancePage } from "@/pages/AdvisorPerformancePage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { DealsPage } from "@/pages/DealsPage";
import { DealDetailPage } from "@/pages/DealDetailPage";
import { ToolsPage } from "@/pages/ToolsPage";
import { PortfolioRiskCalculatorPage } from "@/pages/PortfolioRiskCalculatorPage";
import { NoAccessPage } from "@/pages/NoAccessPage";
import { canManage, roleLevel } from "@/lib/permissions";

function ProtectedRoute({ children, minRole }: { children: React.ReactNode; minRole?: number }) {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (minRole !== undefined && roleLevel(currentUser.role) < minRole) return <NoAccessPage />;
  return <>{children}</>;
}

function TeamProfileRoute() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuthStore();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!canManage(currentUser) && currentUser.id !== id) return <NoAccessPage />;

  return <AdvisorPerformancePage />;
}

export default function App() {
  const { currentUser } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={currentUser ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="activities" element={<ActivitiesPage />} />
        <Route path="activities/:id" element={<ActivityDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="deals/:id" element={<DealDetailPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/portfolio-risk" element={<PortfolioRiskCalculatorPage />} />
        <Route path="team" element={<ProtectedRoute minRole={2}><TeamPage /></ProtectedRoute>} />
        <Route path="team/:id" element={<TeamProfileRoute />} />
        <Route path="audit-logs" element={<ProtectedRoute minRole={2}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
