import { api } from "@/api/client";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { money } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#0d9488", "#0284c7", "#7c3aed", "#d97706", "#e11d48", "#334155"];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<any>("/dashboard") });
  const currency = user?.company?.currency || "MAD";
  const k = data?.kpis || {};

  const kpis = [
    [t("dashboard.revenue"), k.revenue],
    [t("dashboard.monthSales"), k.month_sales],
    [t("dashboard.monthPurchases"), k.month_purchases],
    [t("dashboard.profit"), k.profit],
    [t("dashboard.expenses"), k.expenses],
    [t("dashboard.receivables"), k.receivables],
    [t("dashboard.payables"), k.payables],
    [t("dashboard.stockValue"), k.stock_value],
  ];

  return (
    <div>
      <PageHeader title={t("dashboard.title")} subtitle={`${user?.company?.name || t("brand")} · ${t("dashboard.subtitle")}`} />
      {isLoading && <p className="text-sm text-slate-400">{t("common.loading")}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value]) => (
          <Card key={label as string} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">{money(value, currency)}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("dashboard.customers")}</p>
          <p className="mt-2 text-2xl font-extrabold">{k.customers ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("dashboard.products")}</p>
          <p className="mt-2 text-2xl font-extrabold">{k.products ?? 0}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h3 className="mb-4 font-semibold">{t("dashboard.revenueChart")}</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data?.charts?.revenue || []}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" fill="url(#rev)" />
                <Area type="monotone" dataKey="purchases" stroke="#0284c7" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">{t("dashboard.expensesChart")}</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.charts?.expenses_by_category || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {(data?.charts?.expenses_by_category || []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 xl:col-span-2">
          <h3 className="mb-4 font-semibold">{t("dashboard.topProducts")}</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.charts?.top_products || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#0d9488" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">{t("dashboard.stockChart")}</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.charts?.stock || []}>
                <XAxis dataKey="name" hide />
                <Tooltip />
                <Bar dataKey="stock" fill="#0284c7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Activity title={t("dashboard.recentSales")} rows={data?.activity?.sales} label={(r) => `${r.number} · ${r.customers?.name || ""}`} />
        <Activity title={t("dashboard.recentOrders")} rows={data?.activity?.orders} label={(r) => `${r.number} · ${r.suppliers?.name || ""}`} />
        <Activity title={t("dashboard.recentInvoices")} rows={data?.activity?.invoices} label={(r) => r.number} />
        <Activity title={t("dashboard.recentPayments")} rows={data?.activity?.payments} label={(r) => `${r.method} · ${money(r.amount, currency)}`} />
        <Activity title={t("dashboard.newCustomers")} rows={data?.activity?.customers} label={(r) => r.name} />
        <Activity title={t("dashboard.stockAlerts")} rows={data?.activity?.stock_alerts} label={(r) => `${r.name} (${r.stock_quantity})`} />
      </div>
    </div>
  );
}

function Activity({ title, rows, label }: { title: string; rows?: any[]; label: (r: any) => string }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ul className="space-y-2">
        {(rows || []).length === 0 && <li className="text-sm text-slate-400">—</li>}
        {(rows || []).map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-3 font-medium text-slate-700">{label(r)}</span>
            {r.total !== undefined && <span className="text-slate-400">{money(r.total)}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
