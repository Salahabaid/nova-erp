import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import type { Page } from "@/types";
import { money, statusTone } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const emptyEmployee = { first_name: "", last_name: "", email: "", phone: "", position: "", department: "", hire_date: "", status: "active", salary: 0 };

export function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEmployee);
  const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Page<any>>("/employees?page_size=40") });

  const save = async () => {
    try {
      const payload = { ...form, hire_date: form.hire_date || null, salary: form.salary || null };
      if (editing) await api.patch(`/employees/${editing}`, payload);
      else await api.post("/employees", payload);
      toast.success(editing ? "Employé mis à jour." : "Employé créé avec succès.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch {
      toast.error("Impossible d'enregistrer l'employé.");
    }
  };

  return (
    <div>
      <PageHeader title="Employés" actions={<Button onClick={() => { setForm(emptyEmployee); setEditing(null); setOpen(true); }}>Nouvel employé</Button>} />
      <Card>
        <DataTable
          loading={isLoading}
          empty="Aucun employé."
          rows={data?.items || []}
          columns={[
            { key: "name", header: "Nom", render: (r) => `${r.first_name} ${r.last_name}` },
            { key: "position", header: "Poste" },
            { key: "department", header: "Département" },
            { key: "email", header: "Email" },
            { key: "salary", header: "Salaire", render: (r) => r.salary ? money(r.salary) : "—" },
            { key: "status", header: "Statut", render: (r) => <Badge className={statusTone[r.status]}>{r.status}</Badge> },
            {
              key: "a",
              header: "",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setEditing(r.id); setForm({ ...emptyEmployee, ...r, hire_date: r.hire_date || "", salary: r.salary || 0 }); setOpen(true); }}>Modifier</Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Supprimer cet employé ?")) return;
                      await api.delete(`/employees/${r.id}`);
                      toast.success("Employé supprimé.");
                      qc.invalidateQueries({ queryKey: ["employees"] });
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={open} title={editing ? "Modifier l'employé" : "Nouvel employé"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom" required><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
          <Field label="Nom" required><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Poste"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
          <Field label="Département"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Date d'embauche"><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></Field>
          <Field label="Salaire"><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></Field>
          <Field label="Statut">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="on_leave">Congé</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  );
}

const COLS = [
  { id: "todo", title: "À faire" },
  { id: "in_progress", title: "En cours" },
  { id: "done", title: "Terminée" },
  { id: "cancelled", title: "Annulée" },
];

export function TasksPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", status: "todo", assignee_id: "", related_module: "" });
  const { data } = useQuery({ queryKey: ["tasks"], queryFn: () => api.get<{ items: any[] }>("/tasks") });
  const { data: people } = useQuery({ queryKey: ["directory"], queryFn: () => api.get<any[]>("/auth/directory") });
  const tasks = data?.items || [];

  const move = async (id: string, status: string) => {
    await api.patch(`/tasks/${id}`, { status });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div>
      <PageHeader
        title="Tâches"
        actions={
          <>
            <Button variant="secondary" onClick={() => setView(view === "kanban" ? "list" : "kanban")}>{view === "kanban" ? "Vue liste" : "Vue Kanban"}</Button>
            <Button onClick={() => setOpen(true)}>Nouvelle tâche</Button>
          </>
        }
      />
      {view === "list" ? (
        <Card>
          <DataTable
            empty="Aucune tâche."
            rows={tasks}
            columns={[
              { key: "title", header: "Titre" },
              { key: "priority", header: "Priorité", render: (r) => <Badge className={statusTone[r.priority]}>{r.priority}</Badge> },
              { key: "assignee", header: "Responsable", render: (r) => r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "—" },
              { key: "due_date", header: "Échéance" },
              { key: "status", header: "Statut" },
            ]}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.id} className="rounded-2xl bg-slate-100/80 p-3">
              <p className="mb-3 px-1 text-sm font-semibold text-slate-600">{col.title}</p>
              <div className="space-y-2">
                {tasks.filter((t) => t.status === col.id).map((t) => (
                  <div key={t.id} className="rounded-2xl bg-white p-3 shadow-card">
                    <p className="font-semibold">{t.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{t.due_date || "Sans date"} · {t.priority}{t.profiles ? ` · ${t.profiles.first_name}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {COLS.filter((c) => c.id !== t.status).map((c) => (
                        <button key={c.id} onClick={() => move(t.id, c.id)} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100">
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} title="Nouvelle tâche" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Titre" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Priorité">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Non assigné</option>
              {(people || []).map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </Select>
          </Field>
          <Field label="Module associé">
            <Select value={form.related_module} onChange={(e) => setForm({ ...form, related_module: e.target.value })}>
              <option value="">—</option>
              {["sales", "purchases", "inventory", "invoices", "customers"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Échéance"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          <Button
            className="w-full"
            onClick={async () => {
              await api.post("/tasks", { ...form, due_date: form.due_date || null, assignee_id: form.assignee_id || null, related_module: form.related_module || null });
              toast.success("Tâche créée.");
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["tasks"] });
            }}
          >
            Créer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function DocumentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: () => api.get<Page<any>>("/documents") });

  return (
    <div>
      <PageHeader
        title="Documents"
        actions={
          <label className="inline-flex cursor-pointer items-center rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white">
            Téléverser
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                try {
                  await api.post("/documents", fd);
                  toast.success("Document ajouté.");
                  qc.invalidateQueries({ queryKey: ["documents"] });
                } catch (err: any) {
                  toast.error(err.message);
                }
              }}
            />
          </label>
        }
      />
      <Card>
        <DataTable
          loading={isLoading}
          empty="Aucun document."
          rows={data?.items || []}
          columns={[
            { key: "name", header: "Fichier" },
            { key: "mime_type", header: "Type" },
            { key: "created_at", header: "Date", render: (r) => String(r.created_at).slice(0, 10) },
            { key: "a", header: "", render: (r) => <a className="text-brand-700" href={r.file_url} target="_blank" rel="noreferrer">Ouvrir</a> },
          ]}
        />
      </Card>
    </div>
  );
}
