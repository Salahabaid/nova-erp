import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Field, Input, Modal, Select } from "@/components/ui";
import type { Page } from "@/types";
import { money } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const EXP_CATS = [
  ["transport", "Transport"],
  ["salaries", "Salaires"],
  ["marketing", "Marketing"],
  ["equipment", "Matériel"],
  ["software", "Logiciel"],
  ["rent", "Loyer"],
  ["electricity", "Électricité"],
  ["phone", "Téléphone"],
  ["other", "Autres"],
];

export function PaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payment_type: "customer", amount: 0, method: "transfer", reference: "", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
  const { data, isLoading } = useQuery({ queryKey: ["payments"], queryFn: () => api.get<Page<any>>("/payments?page_size=30") });

  return (
    <div>
      <PageHeader title="Paiements" subtitle="Encaissements, décaissements et remboursements." actions={<Button onClick={() => setOpen(true)}>Nouveau paiement</Button>} />
      <Card>
        <DataTable
          loading={isLoading}
          empty="Aucun paiement."
          rows={data?.items || []}
          columns={[
            { key: "payment_date", header: "Date" },
            { key: "payment_type", header: "Type" },
            { key: "method", header: "Méthode" },
            { key: "party", header: "Tiers", render: (r) => r.customers?.name || r.suppliers?.name || "—" },
            { key: "invoice", header: "Document", render: (r) => r.invoices?.number || r.reference || "—" },
            { key: "amount", header: "Montant", render: (r) => money(r.amount) },
          ]}
        />
      </Card>
      <Modal open={open} title="Nouveau paiement" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Type">
            <Select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              <option value="customer">Client</option>
              <option value="supplier">Fournisseur</option>
              <option value="expense">Dépense</option>
              <option value="refund">Remboursement</option>
            </Select>
          </Field>
          <Field label="Montant"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Date"><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></Field>
          <Field label="Méthode">
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Espèces</option>
              <option value="transfer">Virement</option>
              <option value="card">Carte</option>
              <option value="check">Chèque</option>
              <option value="other">Autre</option>
            </Select>
          </Field>
          <Field label="Référence"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <Button
            className="w-full"
            onClick={async () => {
              try {
                await api.post("/payments", form);
                toast.success("Paiement enregistré.");
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["payments"] });
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          >
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const emptyExpense = { category: "other", amount: 0, expense_date: new Date().toISOString().slice(0, 10), description: "", vendor: "", receipt_url: "" };

export function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyExpense);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["expenses", category, from, to],
    queryFn: () => api.get<Page<any>>(`/expenses?page_size=40${category ? `&category=${category}` : ""}${from ? `&date_from=${from}` : ""}${to ? `&date_to=${to}` : ""}`),
  });
  const total = (data?.items || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  const save = async () => {
    try {
      if (editing) await api.patch(`/expenses/${editing}`, form);
      else await api.post("/expenses", form);
      toast.success(editing ? "Dépense mise à jour." : "Dépense créée avec succès.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch {
      toast.error("Impossible d'enregistrer la dépense. Vérifiez les informations saisies.");
    }
  };

  return (
    <div>
      <PageHeader title="Dépenses" subtitle={`Total affiché : ${money(total)}`} actions={<Button onClick={() => { setForm(emptyExpense); setEditing(null); setOpen(true); }}>Nouvelle dépense</Button>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Catégorie">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {EXP_CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Du"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Au"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </Card>
      <Card>
        <DataTable
          loading={isLoading}
          empty="Aucune dépense."
          rows={data?.items || []}
          columns={[
            { key: "expense_date", header: "Date" },
            { key: "category", header: "Catégorie" },
            { key: "description", header: "Libellé" },
            { key: "vendor", header: "Tiers" },
            { key: "amount", header: "Montant", render: (r) => money(r.amount) },
            {
              key: "a",
              header: "",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <button className="text-sm text-brand-700" onClick={() => { setEditing(r.id); setForm({ ...emptyExpense, ...r }); setOpen(true); }}>Modifier</button>
                  <button
                    className="text-sm text-rose-600"
                    onClick={async () => {
                      if (!confirm("Supprimer cette dépense ?")) return;
                      await api.delete(`/expenses/${r.id}`);
                      toast.success("Dépense supprimée.");
                      qc.invalidateQueries({ queryKey: ["expenses"] });
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={open} title={editing ? "Modifier la dépense" : "Nouvelle dépense"} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Catégorie">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXP_CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Montant"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Date"><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
          <Field label="Libellé"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Fournisseur / bénéficiaire"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
          <Field label="Justificatif (URL)"><Input value={form.receipt_url || ""} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} /></Field>
          <Button className="w-full" onClick={save}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  );
}
