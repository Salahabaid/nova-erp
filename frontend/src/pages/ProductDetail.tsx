import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Card } from "@/components/ui";
import type { Product } from "@/types";
import { money, statusTone } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

export default function ProductDetail() {
  const { id } = useParams();
  const { data } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<Product & { movements?: any[] }>(`/products/${id}`),
  });
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        subtitle={`${data.sku} · ${data.categories?.name || "Sans catégorie"}`}
        actions={
          <Link to="/products" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold">
            Retour au catalogue
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 space-y-2 text-sm">
          <p className="text-slate-500">{data.description || "Aucune description."}</p>
          <p><span className="text-slate-400">Fournisseur</span> · {data.suppliers?.name || "—"}</p>
          <p><span className="text-slate-400">Unité</span> · {data.unit}</p>
          <Badge className={statusTone[data.status]}>{data.status}</Badge>
        </Card>
        <Card className="p-5 space-y-2">
          <p className="text-xs uppercase text-slate-400">Stock actuel</p>
          <p className={`text-3xl font-extrabold ${Number(data.stock_quantity) <= Number(data.min_stock) ? "text-rose-600" : ""}`}>
            {data.stock_quantity}
          </p>
          <p className="text-sm text-slate-500">Seuil min. {data.min_stock}</p>
          <p className="text-sm">Achat {money(data.purchase_price)} · Vente {money(data.sale_price)}</p>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Historique des mouvements</h3>
        <ul className="space-y-2 text-sm">
          {(data.movements || []).length === 0 && <li className="text-slate-400">Aucun mouvement.</li>}
          {(data.movements || []).map((m: any) => (
            <li key={m.id} className="flex justify-between border-b border-slate-50 py-2">
              <span>{String(m.created_at).slice(0, 16).replace("T", " ")} · {m.movement_type}</span>
              <span className="font-semibold">{m.quantity}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
