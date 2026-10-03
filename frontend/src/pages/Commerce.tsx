import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Field, Input, Modal, Select } from "@/components/ui";
import type { Doc, Line, Page } from "@/types";
import { money, qs, statusTone } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

type Kind = "quotes" | "sales-orders" | "purchases" | "invoices";

const META: Record<Kind, { title: string; party: "customer" | "supplier"; itemsKey: string; createPath: string }> = {
  quotes: { title: "Devis", party: "customer", itemsKey: "quote_items", createPath: "/quotes/new" },
  "sales-orders": { title: "Commandes clients", party: "customer", itemsKey: "sales_order_items", createPath: "/sales/orders/new" },
  purchases: { title: "Commandes fournisseurs", party: "supplier", itemsKey: "purchase_order_items", createPath: "/purchases/new" },
  invoices: { title: "Factures", party: "customer", itemsKey: "invoice_items", createPath: "/invoices/new" },
};

export function SalesHub() {
  return (
    <div>
      <PageHeader title="Ventes" subtitle="Devis → Commande → Livraison → Facture → Paiement" />
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/quotes" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Workflow</p>
          <h2 className="mt-2 text-xl font-extrabold">Devis</h2>
          <p className="mt-1 text-sm text-slate-500">Créer, envoyer et convertir en commande.</p>
        </Link>
        <Link to="/sales/orders" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Workflow</p>
          <h2 className="mt-2 text-xl font-extrabold">Commandes</h2>
          <p className="mt-1 text-sm text-slate-500">Livrer et facturer les commandes clients.</p>
        </Link>
      </div>
    </div>
  );
}

export function CommerceList({ kind }: { kind: Kind }) {
  const meta = META[kind];
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const endpoint = kind === "sales-orders" ? "/sales-orders" : `/${kind}`;
  const { data, isLoading } = useQuery({
    queryKey: [kind, page, search, status],
    queryFn: () => api.get<Page<Doc>>(`${endpoint}${qs({ page, page_size: 15, search, status })}`),
  });

  return (
    <div>
      <PageHeader title={meta.title} actions={<Button onClick={() => navigate(meta.createPath)}>Nouveau</Button>} />
      <Card>
        <div className="flex gap-3 p-4">
          <Input placeholder="N° document…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyée</option>
            <option value="confirmed">Confirmée</option>
            <option value="paid">Payée</option>
            <option value="cancelled">Annulée</option>
          </Select>
        </div>
        <DataTable
          loading={isLoading}
          empty="Aucun document."
          rows={data?.items || []}
          page={page}
          pageSize={15}
          total={data?.total || 0}
          onPage={setPage}
          onRow={(r) => navigate(`${kind === "sales-orders" ? "/sales/orders" : `/${kind}`}/${r.id}`)}
          columns={[
            { key: "number", header: "N°", render: (r) => <span className="font-semibold">{r.number}</span> },
            { key: "party", header: meta.party === "customer" ? "Client" : "Fournisseur", render: (r) => r.customers?.name || r.suppliers?.name },
            { key: "issue_date", header: "Date" },
            { key: "total", header: "Total TTC", render: (r) => money(r.total) },
            { key: "status", header: "Statut", render: (r) => <Badge className={statusTone[r.status] || "bg-slate-100"}>{r.status}</Badge> },
          ]}
        />
      </Card>
    </div>
  );
}

export function CommerceEditor({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const meta = META[kind];
  const qc = useQueryClient();
  const navigate = useNavigate();
  const endpoint = kind === "sales-orders" ? "/sales-orders" : `/${kind}`;
  const { data: existing } = useQuery({
    queryKey: [kind, id],
    queryFn: () => api.get<Doc>(`${endpoint}/${id}`),
    enabled: !isNew,
  });
  const { data: customers } = useQuery({ queryKey: ["customers-mini"], queryFn: () => api.get<Page<any>>("/customers?page_size=100") });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers-mini"], queryFn: () => api.get<Page<any>>("/suppliers?page_size=100") });
  const { data: products } = useQuery({ queryKey: ["products-mini"], queryFn: () => api.get<Page<any>>("/products?page_size=100") });

  const [partyId, setPartyId] = useState("");
  const [invoiceType, setInvoiceType] = useState("sales");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Line[]>([{ description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount: 0 }]);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: 0, method: "transfer", reference: "" });
  const [recvOpen, setRecvOpen] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setPartyId(existing.customer_id || existing.supplier_id || "");
    setDiscount(Number(existing.discount || 0));
    setNotes(existing.notes || "");
    setInvoiceType(existing.invoice_type || "sales");
    const lines = (existing as any)[meta.itemsKey] || [];
    if (lines.length) setItems(lines);
  }, [existing, meta.itemsKey]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    items.forEach((i) => {
      const ht = Math.max(0, i.quantity * i.unit_price - (i.discount || 0));
      subtotal += ht;
      tax += ht * (i.tax_rate / 100);
    });
    const after = Math.max(0, subtotal - discount);
    const ratio = subtotal ? after / subtotal : 0;
    return { subtotal, tax: tax * ratio, total: after + tax * ratio };
  }, [items, discount]);

  const addProduct = (pid: string) => {
    const p = products?.items.find((x) => x.id === pid);
    if (!p) return;
    setItems((s) => [...s, { product_id: p.id, description: p.name, quantity: 1, unit_price: kind === "purchases" || invoiceType === "purchase" ? p.purchase_price : p.sale_price, tax_rate: p.tax_rate, discount: 0 }]);
  };

  const payload = () => ({
    customer_id: meta.party === "customer" || invoiceType === "sales" ? partyId : null,
    supplier_id: meta.party === "supplier" || invoiceType === "purchase" ? partyId : null,
    invoice_type: kind === "invoices" ? invoiceType : undefined,
    discount,
    notes,
    items: items.filter((i) => i.description),
  });

  const save = async () => {
    try {
      if (isNew) {
        const created = await api.post<Doc>(endpoint, payload());
        toast.success("Document créé avec succès.");
        navigate(`${kind === "sales-orders" ? "/sales/orders" : `/${kind}`}/${created.id}`);
      } else {
        await api.patch(`${endpoint}/${id}`, payload());
        toast.success("Document enregistré.");
        qc.invalidateQueries({ queryKey: [kind, id] });
      }
    } catch (e: any) {
      toast.error(e.message || "Impossible d'enregistrer le document.");
    }
  };

  const action = async (path: string, body?: unknown, msg?: string) => {
    try {
      const res = await api.post<Doc>(`${endpoint}/${id}/${path}`, body);
      toast.success(msg || "Action effectuée.");
      if (path === "convert") navigate(`/sales/orders/${res.id}`);
      else if (path === "invoice") navigate(`/invoices/${res.id}`);
      else qc.invalidateQueries({ queryKey: [kind, id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title={isNew ? `Nouveau — ${meta.title}` : existing?.number || meta.title}
        subtitle={existing ? `Statut : ${existing.status}` : "Brouillon"}
        actions={
          <>
            {!isNew && kind === "quotes" && <Button variant="secondary" onClick={() => action("convert", {}, "Devis converti en commande.")}>Convertir en commande</Button>}
            {!isNew && kind === "sales-orders" && (
              <>
                <Button variant="secondary" onClick={() => setRecvOpen(true)}>Livrer</Button>
                <Button variant="secondary" onClick={() => action("invoice", {}, "Commande facturée.")}>Facturer</Button>
              </>
            )}
            {!isNew && kind === "purchases" && <Button variant="secondary" onClick={() => setRecvOpen(true)}>Réceptionner</Button>}
            {!isNew && kind === "invoices" && (
              <>
                <Button variant="secondary" onClick={async () => { const blob = await api.blob(`/invoices/${id}/pdf`); const url = URL.createObjectURL(blob); window.open(url); }}>PDF / Imprimer</Button>
                <Button variant="secondary" onClick={() => action("duplicate", {}, "Facture dupliquée.")}>Dupliquer</Button>
                <Button onClick={() => { setPay({ amount: Number(existing?.total || 0) - Number(existing?.paid_amount || 0), method: "transfer", reference: "" }); setPayOpen(true); }}>Paiement</Button>
              </>
            )}
            <Button onClick={save}>Enregistrer</Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {kind === "invoices" && (
            <Field label="Type">
              <Select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
                <option value="sales">Vente</option>
                <option value="purchase">Achat</option>
              </Select>
            </Field>
          )}
          <Field label={meta.party === "supplier" || invoiceType === "purchase" ? "Fournisseur" : "Client"} required>
            <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Sélectionner</option>
              {((meta.party === "supplier" || invoiceType === "purchase") ? suppliers?.items : customers?.items)?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Remise document">
            <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Lignes</h3>
            <Select defaultValue="" onChange={(e) => { addProduct(e.target.value); e.target.value = ""; }}>
              <option value="">Ajouter un produit…</option>
              {(products?.items || []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            {items.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 rounded-xl bg-slate-50 p-2">
                <Input className="col-span-12 sm:col-span-4" placeholder="Désignation" value={line.description} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                <Input className="col-span-4 sm:col-span-2" type="number" placeholder="Qté" value={line.quantity} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                <Input className="col-span-4 sm:col-span-2" type="number" placeholder="PU" value={line.unit_price} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
                <Input className="col-span-4 sm:col-span-1" type="number" placeholder="TVA" value={line.tax_rate} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, tax_rate: Number(e.target.value) } : x))} />
                <div className="col-span-8 flex items-center text-sm font-semibold sm:col-span-2">{money(Math.max(0, line.quantity * line.unit_price - (line.discount || 0)))}</div>
                <button className="col-span-4 text-sm text-rose-600 sm:col-span-1" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
          </div>
          <Button className="mt-3" variant="secondary" onClick={() => setItems((s) => [...s, { description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount: 0 }])}>Ajouter une ligne</Button>
        </div>

        <div className="mt-6 ml-auto max-w-sm space-y-1 text-sm">
          <Row label="Sous-total HT" value={money(totals.subtotal)} />
          <Row label="Remise" value={money(discount)} />
          <Row label="TVA" value={money(totals.tax)} />
          <Row label="Total TTC" value={money(totals.total)} bold />
          {existing?.paid_amount !== undefined && (
            <>
              <Row label="Payé" value={money(existing.paid_amount)} />
              <Row label="Reste" value={money(Number(existing.total) - Number(existing.paid_amount || 0))} />
            </>
          )}
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <Modal open={payOpen} title="Enregistrer un paiement" onClose={() => setPayOpen(false)}>
        <div className="space-y-3">
          <Field label="Montant"><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></Field>
          <Field label="Méthode">
            <Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              <option value="cash">Espèces</option>
              <option value="transfer">Virement</option>
              <option value="card">Carte</option>
              <option value="check">Chèque</option>
              <option value="other">Autre</option>
            </Select>
          </Field>
          <Field label="Référence"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
          <Button
            className="w-full"
            onClick={async () => {
              await api.post("/payments", {
                payment_type: existing?.invoice_type === "purchase" ? "supplier" : "customer",
                amount: pay.amount,
                method: pay.method,
                reference: pay.reference,
                invoice_id: id,
                customer_id: existing?.customer_id,
                supplier_id: existing?.supplier_id,
              });
              toast.success("Paiement enregistré.");
              setPayOpen(false);
              qc.invalidateQueries({ queryKey: [kind, id] });
            }}
          >
            Valider
          </Button>
        </div>
      </Modal>

      <ReceiveModal
        open={recvOpen}
        items={((existing as any)?.[meta.itemsKey] || []).map((i: any) => ({
          id: i.id,
          description: i.description,
          remaining: Number(i.quantity) - Number(i.received_qty || i.delivered_qty || 0),
        }))}
        onClose={() => setRecvOpen(false)}
        onSubmit={async (rows) => {
          await action(kind === "purchases" ? "receive" : "deliver", { items: rows }, kind === "purchases" ? "Réception enregistrée. Stock mis à jour." : "Livraison enregistrée. Stock mis à jour.");
          setRecvOpen(false);
        }}
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-extrabold" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ReceiveModal({ open, items, onClose, onSubmit }: { open: boolean; items: any[]; onClose: () => void; onSubmit: (rows: any[]) => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  return (
    <Modal open={open} title="Quantités" onClose={onClose}>
      <div className="space-y-3">
        {items.map((i) => (
          <Field key={i.id} label={`${i.description} (reste ${i.remaining})`}>
            <Input type="number" value={qty[i.id] ?? i.remaining} onChange={(e) => setQty((s) => ({ ...s, [i.id]: Number(e.target.value) }))} />
          </Field>
        ))}
        <Button className="w-full" onClick={() => onSubmit(items.map((i) => ({ id: i.id, quantity: qty[i.id] ?? i.remaining })))}>Valider</Button>
      </div>
    </Modal>
  );
}
