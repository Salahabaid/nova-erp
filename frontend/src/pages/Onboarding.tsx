import { api } from "@/api/client";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Onboarding() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    country: "MA",
    currency: "MAD",
    default_tax_rate: 20,
    email: "",
    phone: "",
    city: "",
    address: "",
    tax_id: "",
    language: "fr",
  });
  const set = (k: string, v: string | number) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-2 font-extrabold text-ink-950">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">N</span>
        Nova ERP
      </div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Étape 1 / 1</p>
        <h1 className="mt-2 text-3xl font-extrabold">{t("onboarding.title")}</h1>
        <p className="mt-2 text-slate-500">{t("onboarding.subtitle")}</p>
      </div>
      <form
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.post("/onboarding", form);
            await refresh();
            toast.success("Entreprise configurée.");
            navigate("/");
          } catch (err: any) {
            toast.error(err.message);
          }
        }}
      >
        <Field label={t("onboarding.name")} required>
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("onboarding.country")}>
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label={t("onboarding.currency")}>
            <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>
          <Field label={t("onboarding.tax")}>
            <Input type="number" value={form.default_tax_rate} onChange={(e) => set("default_tax_rate", Number(e.target.value))} />
          </Field>
          <Field label="ICE / identifiant fiscal">
            <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
        <Field label="Adresse">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Button className="w-full py-2.5">{t("onboarding.start")}</Button>
      </form>
    </div>
  );
}
