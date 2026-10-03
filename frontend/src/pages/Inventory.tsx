import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Field, Input, Modal, Select } from "@/components/ui";
import type { Page } from "@/types";
import { money } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export default function Inventory() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", movement_type: "in", quantity: 1, notes: "", warehouse_id: "", to_warehouse_id: "" });
  const { data: alerts } = useQuery({ queryKey: ["inv-alerts"], queryFn: () => api.get<any>("/inventory/alerts") });
  const { data: moves, isLoading } = useQuery({ queryKey: ["movements"], queryFn: () => api.get<Page<any>>("/inventory/movements?page_size=30") });
  const { data: products } = useQuery({ queryKey: ["products-mini"], queryFn: () => api.get<Page<any>>("/products?page_size=100") });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: () => api.get<any[]>("/inventory/warehouses") });

  return (
    <div>
      <PageHeader
        title="Stocks"
        subtitle="Entrées, sorties, transferts, ajustements et valorisation."
        actions={<Button onClick={() => setOpen(true)}>Nouveau mouvement</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-slate-400">Valorisation</p><p className="text-2xl font-extrabold">{money(alerts?.valuation)}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400">Stock faible</p><p className="text-2xl font-extrabold text-amber-600">{alerts?.low_stock?.length || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400">Ruptures</p><p className="text-2xl font-extrabold text-rose-600">{alerts?.out_of_stock?.length || 0}</p></Card>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b px-4 py-3 font-semibold">Alertes</div>
          <DataTable
            empty="Aucune alerte."
            rows={[...(alerts?.out_of_stock || []), ...(alerts?.low_stock || [])]}
            columns={[
              { key: "sku", header: "SKU" },
              { key: "name", header: "Produit" },
              { key: "stock_quantity", header: "Stock" },
              { key: "min_stock", header: "Min" },
            ]}
          />
        </Card>
        <Card>
          <div className="border-b px-4 py-3 font-semibold">Historique des mouvements</div>
          <DataTable
            loading={isLoading}
            empty="Aucun mouvement."
            rows={moves?.items || []}
            columns={[
              { key: "created_at", header: "Date", render: (r) => String(r.created_at).slice(0, 10) },
              { key: "p", header: "Produit", render: (r) => r.products?.name },
              { key: "movement_type", header: "Type", render: (r) => <Badge className="bg-slate-100">{r.movement_type}</Badge> },
              { key: "quantity", header: "Qté" },
            ]}
          />
        </Card>
      </div>
      <Modal open={open} title="Mouvement de stock" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Produit" required>
            <Select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Sélectionner</option>
              {(products?.items || []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value })}>
              <option value="in">Entrée</option>
              <option value="out">Sortie</option>
              <option value="transfer">Transfert</option>
              <option value="adjustment">Ajustement</option>
              <option value="inventory">Inventaire (stock compté)</option>
            </Select>
          </Field>
          <Field label="Quantité"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
          <Field label="Entrepôt">
            <Select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
              <option value="">—</option>
              {(warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          {form.movement_type === "transfer" && (
            <Field label="Destination">
              <Select value={form.to_warehouse_id} onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })}>
                <option value="">—</option>
                {(warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={async () => {
                try {
                  await api.post("/inventory/movements", { ...form, warehouse_id: form.warehouse_id || null, to_warehouse_id: form.to_warehouse_id || null });
                  toast.success("Mouvement enregistré. Stock recalculé.");
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["movements"] });
                  qc.invalidateQueries({ queryKey: ["inv-alerts"] });
                  qc.invalidateQueries({ queryKey: ["products"] });
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
