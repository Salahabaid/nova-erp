import { Spinner } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

const LoginPage = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/Auth").then((m) => ({ default: m.RegisterPage })));
const CommerceEditor = lazy(() => import("@/pages/Commerce").then((m) => ({ default: m.CommerceEditor })));
const CommerceList = lazy(() => import("@/pages/Commerce").then((m) => ({ default: m.CommerceList })));
const SalesHub = lazy(() => import("@/pages/Commerce").then((m) => ({ default: m.SalesHub })));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ExpensesPage = lazy(() => import("@/pages/Finance").then((m) => ({ default: m.ExpensesPage })));
const PaymentsPage = lazy(() => import("@/pages/Finance").then((m) => ({ default: m.PaymentsPage })));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Parties = lazy(() => import("@/pages/Parties"));
const PartyDetail = lazy(() => import("@/pages/Parties").then((m) => ({ default: m.PartyDetail })));
const DocumentsPage = lazy(() => import("@/pages/People").then((m) => ({ default: m.DocumentsPage })));
const EmployeesPage = lazy(() => import("@/pages/People").then((m) => ({ default: m.EmployeesPage })));
const TasksPage = lazy(() => import("@/pages/People").then((m) => ({ default: m.TasksPage })));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));

function Boot() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  );
}

function Guest({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  if (user) return <Navigate to={user.onboarding_completed ? "/" : "/onboarding"} replace />;
  return <>{children}</>;
}

function Protected({ module }: { module?: string }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Boot />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  if (module && !can(module)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function OnboardGate() {
  const { user, loading } = useAuth();
  if (loading) return <Boot />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboarding_completed) return <Navigate to="/" replace />;
  return <Onboarding />;
}

function Home() {
  const { can } = useAuth();
  if (!can("dashboard")) return <Navigate to="/tasks" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <Suspense fallback={<Boot />}>
      <Routes>
        <Route path="/login" element={<Guest><LoginPage /></Guest>} />
        <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
        <Route path="/onboarding" element={<OnboardGate />} />

        <Route element={<Protected />}>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />

            <Route element={<Protected module="sales" />}>
              <Route path="sales" element={<SalesHub />} />
              <Route path="quotes" element={<CommerceList kind="quotes" />} />
              <Route path="quotes/new" element={<CommerceEditor kind="quotes" />} />
              <Route path="quotes/:id" element={<CommerceEditor kind="quotes" />} />
              <Route path="sales/quotes" element={<CommerceList kind="quotes" />} />
              <Route path="sales/quotes/:id" element={<CommerceEditor kind="quotes" />} />
              <Route path="sales/orders" element={<CommerceList kind="sales-orders" />} />
              <Route path="sales/orders/new" element={<CommerceEditor kind="sales-orders" />} />
              <Route path="sales/orders/:id" element={<CommerceEditor kind="sales-orders" />} />
            </Route>

            <Route element={<Protected module="purchases" />}>
              <Route path="purchases" element={<CommerceList kind="purchases" />} />
              <Route path="purchases/new" element={<CommerceEditor kind="purchases" />} />
              <Route path="purchases/:id" element={<CommerceEditor kind="purchases" />} />
            </Route>

            <Route element={<Protected module="invoices" />}>
              <Route path="invoices" element={<CommerceList kind="invoices" />} />
              <Route path="invoices/new" element={<CommerceEditor kind="invoices" />} />
              <Route path="invoices/:id" element={<CommerceEditor kind="invoices" />} />
            </Route>

            <Route element={<Protected module="products" />}>
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetail />} />
            </Route>
            <Route element={<Protected module="inventory" />}>
              <Route path="inventory" element={<Inventory />} />
            </Route>
            <Route element={<Protected module="customers" />}>
              <Route path="customers" element={<Parties kind="customers" />} />
              <Route path="customers/:id" element={<PartyDetail kind="customers" />} />
            </Route>
            <Route element={<Protected module="suppliers" />}>
              <Route path="suppliers" element={<Parties kind="suppliers" />} />
              <Route path="suppliers/:id" element={<PartyDetail kind="suppliers" />} />
            </Route>
            <Route element={<Protected module="payments" />}>
              <Route path="payments" element={<PaymentsPage />} />
            </Route>
            <Route element={<Protected module="expenses" />}>
              <Route path="expenses" element={<ExpensesPage />} />
            </Route>
            <Route element={<Protected module="employees" />}>
              <Route path="employees" element={<EmployeesPage />} />
            </Route>
            <Route element={<Protected module="tasks" />}>
              <Route path="tasks" element={<TasksPage />} />
            </Route>
            <Route element={<Protected module="documents" />}>
              <Route path="documents" element={<DocumentsPage />} />
            </Route>
            <Route element={<Protected module="reports" />}>
              <Route path="reports" element={<Reports />} />
            </Route>
            <Route element={<Protected module="settings" />}>
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
