import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import type { Page, Party } from "@/types";
import { money, qs, statusTone } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const empty = { name: "", company_name: "", email: "", phone: "", address: "", city: "", country: "MA", tax_id: "", notes: "", status: "active" };

export default function Parties({ kind }: { kind: "customers" | "suppliers" }) {
  const isCustomer = kind === "customers";
  const title = isCustomer ? "Clients" : "Fournisseurs";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: [kind, page, search, status],
    queryFn: () => api.get<Page<Party>>(`/${kind}${qs({ page, page_size: 15, search, status })}`),
  });

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="CRM opérationnel — fiches, historique et soldes."
        actions={<Button onClick={() => { setForm(empty); setOpen(true); }}>Nouveau</Button>}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <Input placeholder="Rechercher nom, email, ville…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </Select>
        </div>
        <DataTable
          loading={isLoading}
          empty="Aucun enregistrement."
          rows={data?.items || []}
          page={page}
          pageSize={15}
          total={data?.total || 0}
          onPage={setPage}
          onRow={(r) => navigate(`/${kind}/${r.id}`)}
          columns={[
            { key: "name", header: "Nom", render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: "email", header: "Email" },
            { key: "phone", header: "Téléphone" },
            { key: "city", header: "Ville" },
            { key: "status", header: "Statut", render: (r) => <Badge className={statusTone[r.status]}>{r.status}</Badge> },
          ]}
        />
      </Card>
      <PartyModal
        open={open}
        title={`Nouveau ${isCustomer ? "client" : "fournisseur"}`}
        form={form}
        setForm={setForm}
        onClose={() => setOpen(false)}
        onSubmit={async () => {
          try {
            await api.post(`/${kind}`, form);
            toast.success(`${isCustomer ? "Client" : "Fournisseur"} créé avec succès.`);
            setOpen(false);
            qc.invalidateQueries({ queryKey: [kind] });
          } catch {
            toast.error(`Impossible de créer ${isCustomer ? "le client" : "le fournisseur"}. Vérifiez les informations saisies.`);
          }
        }}
      />
    </div>
  );
}

export function PartyDetail({ kind }: { kind: "customers" | "suppliers" }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const { data } = useQuery({ queryKey: [kind, id], queryFn: () => api.get<Party>(`/${kind}/${id}`) });
  const [form, setForm] = useState(empty);
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        subtitle={data.company_name || data.email}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setForm({ ...empty, ...data }); setEdit(true); }}>Modifier</Button>
            <Button variant="danger" onClick={() => setDel(true)}>Supprimer</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Item label="Email" value={data.email} />
            <Item label="Téléphone" value={data.phone} />
            <Item label="Adresse" value={data.address} />
            <Item label="Ville" value={data.city} />
            <Item label="Pays" value={data.country} />
            <Item label="ICE" value={data.tax_id} />
            <Item label="Notes" value={data.notes} />
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-slate-400">Solde</p>
          <p className="mt-2 text-3xl font-extrabold">{money(data.balance?.balance)}</p>
          <p className="mt-2 text-sm text-slate-500">Facturé {money(data.balance?.invoiced)} · Payé {money(data.balance?.paid)}</p>
        </Card>
      </div>
      <History title="Commandes" rows={data.orders} />
      <History title="Factures" rows={data.invoices} />
      <History title="Paiements" rows={data.payments} amount />
      <PartyModal
        open={edit}
        title="Modifier"
        form={form}
        setForm={setForm}
        onClose={() => setEdit(false)}
        onSubmit={async () => {
          try {
            await api.patch(`/${kind}/${id}`, form);
            toast.success("Modifications enregistrées.");
            setEdit(false);
            qc.invalidateQueries({ queryKey: [kind, id] });
          } catch {
            toast.error("Impossible d'enregistrer. Vérifiez les informations saisies.");
          }
        }}
      />
      <ConfirmDialog
        open={del}
        title="Supprimer définitivement ?"
        onClose={() => setDel(false)}
        onConfirm={async () => {
          await api.delete(`/${kind}/${id}`);
          toast.success("Supprimé.");
          navigate(`/${kind}`);
        }}
      />
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function History({ title, rows, amount }: { title: string; rows?: any[]; amount?: boolean }) {
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 font-semibold">{title}</div>
      <DataTable
        empty="Aucun historique."
        rows={rows || []}
        columns={[
          { key: "number", header: amount ? "Référence" : "N°", render: (r) => r.number || r.reference || "—" },
          { key: "status", header: "Statut", render: (r) => r.status || r.method },
          { key: "total", header: "Montant", render: (r) => money(r.total ?? r.amount) },
        ]}
      />
    </Card>
  );
}

function PartyModal({ open, title, form, setForm, onClose, onSubmit }: any) {
  const set = (k: string, v: string) => setForm((s: any) => ({ ...s, [k]: v }));
  return (
    <Modal open={open} title={title} onClose={onClose} wide>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Field label="Nom / entreprise" required>
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Raison sociale">
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Ville">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Pays">
          <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="ICE">
          <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
        </Field>
        <Field label="Statut">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adresse">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
