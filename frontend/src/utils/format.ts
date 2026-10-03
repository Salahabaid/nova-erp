export function money(value?: number | string | null, currency = "MAD") {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function dateFmt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const statusTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-sky-50 text-sky-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  accepted: "bg-emerald-50 text-emerald-700",
  converted: "bg-violet-50 text-violet-700",
  received: "bg-emerald-50 text-emerald-700",
  partially_received: "bg-amber-50 text-amber-700",
  partially_delivered: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  invoiced: "bg-cyan-50 text-cyan-700",
  paid: "bg-emerald-50 text-emerald-700",
  partially_paid: "bg-amber-50 text-amber-700",
  overdue: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-rose-50 text-rose-700",
};

export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}
