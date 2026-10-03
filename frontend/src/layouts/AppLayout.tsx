import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { setLanguage } from "@/i18n";
import { cn } from "@/utils/format";
import {
  Bell,
  Boxes,
  Building2,
  ChevronLeft,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PieChart,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

type NavItem = {
  to: string;
  key: string;
  icon: typeof LayoutDashboard;
  module: string;
  children?: { to: string; key: string }[];
};

const NAV: NavItem[] = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, module: "dashboard" },
  {
    to: "/sales",
    key: "sales",
    icon: ShoppingCart,
    module: "sales",
    children: [
      { to: "/quotes", key: "quotes" },
      { to: "/sales/orders", key: "orders" },
    ],
  },
  { to: "/purchases", key: "purchases", icon: Truck, module: "purchases" },
  { to: "/products", key: "products", icon: Package, module: "products" },
  { to: "/inventory", key: "inventory", icon: Boxes, module: "inventory" },
  { to: "/customers", key: "customers", icon: Users, module: "customers" },
  { to: "/suppliers", key: "suppliers", icon: Building2, module: "suppliers" },
  { to: "/invoices", key: "invoices", icon: FileText, module: "invoices" },
  { to: "/payments", key: "payments", icon: Wallet, module: "payments" },
  { to: "/expenses", key: "expenses", icon: Receipt, module: "expenses" },
  { to: "/employees", key: "employees", icon: Users, module: "employees" },
  { to: "/tasks", key: "tasks", icon: ClipboardList, module: "tasks" },
  { to: "/documents", key: "documents", icon: FolderOpen, module: "documents" },
  { to: "/reports", key: "reports", icon: PieChart, module: "reports" },
  { to: "/settings", key: "settings", icon: Settings, module: "settings" },
];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any | null>(null);
  const [notifs, setNotifs] = useState<{ items: any[]; unread: number }>({ items: [], unread: 0 });
  const [bellOpen, setBellOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => NAV.filter((n) => can(n.module)), [user]);

  useEffect(() => {
    setMobileOpen(false);
    setResults(null);
  }, [location.pathname]);

  useEffect(() => {
    api.post("/notifications/refresh").catch(() => null);
  }, []);

  useEffect(() => {
    api.get<{ items: any[]; unread: number }>("/notifications").then(setNotifs).catch(() => null);
  }, [location.pathname]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => null);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const go = (path: string, id: string) => {
    setQ("");
    setResults(null);
    if (path === "/payments") navigate(path);
    else navigate(`${path}/${id}`);
  };

  return (
    <div className="flex min-h-screen bg-[#f3f5f8]">
      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex flex-col border-r border-white/5 bg-ink-950 text-slate-300 transition-all duration-200 lg:static",
          collapsed ? "w-[84px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-sm font-extrabold text-white">N</span>
            {!collapsed && <span className="text-base font-extrabold tracking-tight text-white">Nova ERP</span>}
          </Link>
          <button className="hidden rounded-lg p-1 text-slate-400 hover:bg-white/5 lg:block" onClick={() => setCollapsed((v) => !v)}>
            <ChevronLeft className={cn("transition", collapsed && "rotate-180")} size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const childActive = item.children?.some((c) => location.pathname.startsWith(c.to));
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive || childActive ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
                      collapsed && "justify-center px-2"
                    )
                  }
                >
                  <Icon size={18} />
                  {!collapsed && t(`nav.${item.key}`)}
                </NavLink>
                {!collapsed && item.children && (location.pathname.startsWith("/sales") || location.pathname.startsWith("/quotes")) && (
                  <div className="mb-1 ml-8 mt-0.5 space-y-0.5">
                    {item.children.map((c) => (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        className={({ isActive }) =>
                          cn("block rounded-lg px-2 py-1.5 text-xs font-medium", isActive ? "text-white" : "text-slate-400 hover:text-white")
                        }
                      >
                        {t(`nav.${c.key}`)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/5 p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/5">
            <LogOut size={18} />
            {!collapsed && t("auth.logout")}
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl">
          <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />
            {results && (
              <div className="absolute mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
                {["customers", "suppliers", "products", "orders", "invoices", "payments"].map((group) =>
                  results[group]?.length ? (
                    <div key={group} className="border-b border-slate-50 px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                      {results[group].map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() =>
                            go(
                              group === "orders"
                                ? "/sales/orders"
                                : group === "payments"
                                  ? "/payments"
                                  : group === "products"
                                    ? "/products"
                                    : `/${group}`,
                              r.id
                            )
                          }
                          className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                        >
                          {r.name || r.number || r.reference || r.sku}{" "}
                          <span className="text-slate-400">{r.email || r.sku || ""}</span>
                        </button>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
          <select
            value={i18n.language}
            onChange={(e) => setLanguage(e.target.value)}
            className="hidden rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 sm:block"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="ar">AR</option>
          </select>
          <div className="relative">
            <button onClick={() => setBellOpen((v) => !v)} className="relative rounded-xl p-2 hover:bg-slate-100">
              <Bell size={18} />
              {notifs.unread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-sm font-semibold">Notifications</p>
                  <button
                    className="text-xs text-brand-700"
                    onClick={() => api.post("/notifications/read-all").then(() => setNotifs({ items: notifs.items.map((n) => ({ ...n, is_read: true })), unread: 0 }))}
                  >
                    Tout lire
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.items.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-400">Aucune notification</p>}
                  {notifs.items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => api.post(`/notifications/${n.id}/read`).then(() => setNotifs((s) => ({ ...s, items: s.items.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)), unread: Math.max(0, s.unread - 1) })))}
                      className={cn("mb-1 w-full rounded-xl px-3 py-2 text-left", !n.is_read && "bg-brand-50")}
                    >
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.message}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white">
              {(user?.first_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold leading-tight">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-400">{user?.role?.name}</p>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
