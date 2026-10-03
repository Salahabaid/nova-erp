import { api } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import type { Company, Page } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { user, refresh, has } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("company");
  const [company, setCompany] = useState<Company>((user?.company || { name: "" }) as Company);
  useEffect(() => {
    if (user?.company) setCompany(user.company);
  }, [user]);
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "", avatar_url: user?.avatar_url || "" });
  const { data: audit } = useQuery({ queryKey: ["audit"], queryFn: () => api.get<Page<any>>("/settings/audit"), enabled: tab === "security" && has("users.manage") });
  const [invite, setInvite] = useState({ email: "", first_name: "", last_name: "", role_id: "", password: "ChangeMe123!" });

  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get<Page<any>>("/auth/users"), enabled: has("users.manage") });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<any[]>("/auth/roles"), enabled: has("users.manage") });

  const tabs = [
    ["company", "Entreprise"],
    ["profile", "Profil"],
    ["users", "Utilisateurs"],
    ["billing", "Facturation"],
    ["notifications", "Notifications"],
    ["security", "Sécurité"],
  ];

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Entreprise, utilisateurs, numérotation et sécurité." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === id ? "bg-ink-900 text-white" : "bg-white text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "company" && (
        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom"><Input value={company.name || ""} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></Field>
            <Field label="Email"><Input value={company.email || ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={company.phone || ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></Field>
            <Field label="ICE"><Input value={company.tax_id || ""} onChange={(e) => setCompany({ ...company, tax_id: e.target.value })} /></Field>
            <Field label="Pays"><Input value={company.country || ""} onChange={(e) => setCompany({ ...company, country: e.target.value })} /></Field>
            <Field label="Logo (URL)"><Input value={company.logo_url || ""} onChange={(e) => setCompany({ ...company, logo_url: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Adresse"><Input value={company.address || ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></Field></div>
          </div>
          <Button className="mt-4" onClick={async () => { await api.patch("/settings/company", company); await refresh(); toast.success("Entreprise mise à jour."); }}>Enregistrer</Button>
        </Card>
      )}

      {tab === "billing" && (
        <Card className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Devise"><Input value={company.currency || "MAD"} onChange={(e) => setCompany({ ...company, currency: e.target.value })} /></Field>
            <Field label="TVA %"><Input type="number" value={company.default_tax_rate || 20} onChange={(e) => setCompany({ ...company, default_tax_rate: Number(e.target.value) })} /></Field>
            <Field label="Préfixe factures"><Input value={(company as any).invoice_prefix || "FAC"} onChange={(e) => setCompany({ ...company, invoice_prefix: e.target.value } as any)} /></Field>
            <Field label="Préfixe devis"><Input value={(company as any).quote_prefix || "DEV"} onChange={(e) => setCompany({ ...company, quote_prefix: e.target.value } as any)} /></Field>
          </div>
          <Button className="mt-4" onClick={async () => { await api.patch("/settings/company", company); toast.success("Paramètres de facturation enregistrés."); }}>Enregistrer</Button>
        </Card>
      )}

      {tab === "notifications" && (
        <Card className="p-5 space-y-3">
          {[["notify_low_stock", "Alertes stock faible"], ["notify_overdue_invoices", "Factures en retard"], ["notify_tasks", "Tâches à échéance"]].map(([k, l]) => (
            <label key={k} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={Boolean((company as any)[k] ?? true)} onChange={(e) => setCompany({ ...company, [k]: e.target.checked })} />
              {l}
            </label>
          ))}
          <Button onClick={async () => { await api.patch("/settings/company", company); toast.success("Préférences enregistrées."); }}>Enregistrer</Button>
        </Card>
      )}

      {tab === "profile" && (
        <Card className="max-w-xl space-y-3 p-5">
          <Field label="Prénom"><Input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></Field>
          <Field label="Nom"><Input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          <Field label="Avatar (URL)"><Input value={profile.avatar_url} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} /></Field>
          <Button onClick={async () => { await api.patch("/auth/me", profile); await refresh(); toast.success("Profil mis à jour."); }}>Enregistrer le profil</Button>
        </Card>
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <Card className="max-w-md space-y-3 p-5">
            <p className="text-sm text-slate-500">Session : {user?.email}</p>
            <p className="text-sm text-slate-500">Dernière connexion enregistrée lors du login.</p>
            <Field label="Nouveau mot de passe"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button onClick={async () => { await api.post("/auth/password", { password }); setPassword(""); toast.success("Mot de passe mis à jour."); }}>Changer le mot de passe</Button>
            <Button variant="secondary" onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>Déconnecter cette session</Button>
          </Card>
          {has("users.manage") && (
            <Card>
              <div className="p-4 font-semibold">Journal d’audit</div>
              <DataTable
                empty="Aucun événement."
                rows={audit?.items || []}
                columns={[
                  { key: "created_at", header: "Date", render: (r) => String(r.created_at).slice(0, 16).replace("T", " ") },
                  { key: "action", header: "Action" },
                  { key: "entity", header: "Entité" },
                  { key: "user", header: "Utilisateur", render: (r) => r.profiles?.email || "—" },
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {tab === "users" && has("users.manage") && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Inviter un utilisateur</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom"><Input value={invite.first_name} onChange={(e) => setInvite({ ...invite, first_name: e.target.value })} /></Field>
              <Field label="Nom"><Input value={invite.last_name} onChange={(e) => setInvite({ ...invite, last_name: e.target.value })} /></Field>
              <Field label="Email"><Input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
              <Field label="Rôle">
                <Select value={invite.role_id} onChange={(e) => setInvite({ ...invite, role_id: e.target.value })}>
                  <option value="">Sélectionner</option>
                  {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
              <Field label="Mot de passe temporaire"><Input value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} /></Field>
            </div>
            <Button className="mt-3" onClick={async () => { await api.post("/auth/users", invite); toast.success("Utilisateur créé."); qc.invalidateQueries({ queryKey: ["users"] }); }}>Créer</Button>
          </Card>
          <Card>
            <DataTable
              empty="Aucun utilisateur."
              rows={users?.items || []}
              columns={[
                { key: "name", header: "Nom", render: (r) => `${r.first_name} ${r.last_name}` },
                { key: "email", header: "Email" },
                {
                  key: "role",
                  header: "Rôle",
                  render: (r) => (
                    <Select
                      value={r.role_id || r.roles?.id || ""}
                      onChange={async (e) => {
                        await api.patch(`/auth/users/${r.id}`, { role_id: e.target.value });
                        toast.success("Rôle mis à jour.");
                        qc.invalidateQueries({ queryKey: ["users"] });
                      }}
                    >
                      {(roles || []).map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </Select>
                  ),
                },
                {
                  key: "status",
                  header: "Statut",
                  render: (r) => (
                    <button
                      className="text-sm font-semibold"
                      onClick={async () => {
                        const next = r.status === "active" ? "inactive" : "active";
                        await api.patch(`/auth/users/${r.id}`, { status: next });
                        toast.success("Statut mis à jour.");
                        qc.invalidateQueries({ queryKey: ["users"] });
                      }}
                    >
                      <Badge className="bg-slate-100">{r.status}</Badge>
                    </button>
                  ),
                },
              ]}
            />
          </Card>
          {has("settings.write") && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm("Supprimer toutes les données de démonstration ?")) return;
                await api.post("/settings/demo/purge");
                toast.success("Données de démonstration supprimées.");
              }}
            >
              Supprimer les données de démonstration
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
