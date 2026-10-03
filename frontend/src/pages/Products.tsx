import { api, downloadBlob } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import type { Page, Product } from "@/types";
import { money, qs, statusTone } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const empty = { sku: "", name: "", description: "", category_id: "", purchase_price: 0, sale_price: 0, tax_rate: 20, unit: "unité", min_stock: 0, supplier_id: "", image_url: "", status: "active" };

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search, categoryId],
    queryFn: () => api.get<Page<Product>>(`/products${qs({ page, page_size: 15, search, category_id: categoryId })}`),
  });
  const { data: cats } = useQuery({ queryKey: ["categories"], queryFn: () => api.get<any[]>("/categories") });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers-mini"], queryFn: () => api.get<Page<any>>("/suppliers?page_size=100") });

  const save = async () => {
    try {
      const payload = { ...form, category_id: form.category_id || null, supplier_id: form.supplier_id || null };
      if (editing) await api.patch(`/products/${editing}`, payload);
      else await api.post("/products", payload);
      toast.success(editing ? "Produit mis à jour." : "Produit créé avec succès.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast.error("Impossible d'enregistrer le produit. Vérifiez les informations saisies.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle="Catalogue, prix, TVA et seuils de stock."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadBlob("/products/export/csv", "produits.csv")}>Export CSV</Button>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  try {
                    const res = await api.post<{ message: string }>("/products/import/csv", fd);
                    toast.success(res.message);
                    qc.invalidateQueries({ queryKey: ["products"] });
                  } catch (err: any) {
                    toast.error(err.message || "Import impossible.");
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <CategoryQuick onCreated={() => qc.invalidateQueries({ queryKey: ["categories"] })} />
            <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }}>Nouveau produit</Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row">
          <Input placeholder="SKU ou nom…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="sm:w-56">
            <option value="">Toutes les catégories</option>
            {(cats || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <DataTable
          loading={isLoading}
          empty="Aucun produit."
          rows={data?.items || []}
          page={page}
          pageSize={15}
          total={data?.total || 0}
          onPage={setPage}
          onRow={(r) => navigate(`/products/${r.id}`)}
          columns={[
            { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            { key: "name", header: "Nom", render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: "cat", header: "Catégorie", render: (r) => r.categories?.name || "—" },
            { key: "sale_price", header: "PV", render: (r) => money(r.sale_price) },
            { key: "stock_quantity", header: "Stock", render: (r) => <span className={Number(r.stock_quantity) <= Number(r.min_stock) ? "font-semibold text-rose-600" : ""}>{r.stock_quantity}</span> },
            { key: "status", header: "Statut", render: (r) => <Badge className={statusTone[r.status]}>{r.status}</Badge> },
            {
              key: "a",
              header: "",
              render: (r) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" onClick={() => { setEditing(r.id); setForm({ ...empty, ...r, category_id: r.category_id || "", supplier_id: r.supplier_id || "" }); setOpen(true); }}>Modifier</Button>
                  <Button variant="ghost" onClick={() => setDel(r.id)}>Supprimer</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={open} title={editing ? "Modifier le produit" : "Nouveau produit"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU" required><Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Nom" required><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Catégorie">
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">—</option>
              {(cats || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Fournisseur">
            <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">—</option>
              {(suppliers?.items || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Prix d'achat"><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /></Field>
          <Field label="Prix de vente"><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} /></Field>
          <Field label="TVA %"><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></Field>
          <Field label="Unité"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label="Stock minimum"><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></Field>
          <Field label="Image URL"><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} title="Supprimer ce produit ?" onClose={() => setDel(null)} onConfirm={async () => { await api.delete(`/products/${del}`); toast.success("Produit supprimé."); setDel(null); qc.invalidateQueries({ queryKey: ["products"] }); }} />
    </div>
  );
}

function CategoryQuick({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name) return;
        await api.post("/categories", { name });
        setName("");
        onCreated();
        toast.success("Catégorie créée.");
      }}
    >
      <Input placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
      <Button variant="secondary" type="submit">+</Button>
    </form>
  );
}
