import { useAuth } from "@/contexts/AuthContext";
import { Button, Field, Input } from "@/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-slate-900">{t("auth.welcome")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("auth.subtitle")}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const me = await login(email, password);
            navigate(me.onboarding_completed ? "/" : "/onboarding");
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("auth.email")} required>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("auth.password")} required>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button className="w-full py-2.5" disabled={busy}>
          {t("auth.submit")}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-semibold text-brand-700">
          {t("auth.register")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold">{t("auth.register")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("tagline")}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await register(form);
            navigate("/onboarding");
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("auth.firstName")} required>
            <Input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label={t("auth.lastName")} required>
            <Input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
        </div>
        <Field label={t("auth.email")} required>
          <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label={t("auth.password")} required>
          <Input type="password" minLength={8} required value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Button className="w-full py-2.5" disabled={busy}>
          {t("auth.create")}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="font-semibold text-brand-700">
          {t("auth.login")}
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="flex items-center gap-3 text-lg font-extrabold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500">N</span>
          Nova ERP
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-4xl font-extrabold leading-tight">Une seule plateforme pour piloter l’entreprise.</p>
          <p className="mt-4 text-slate-300">
            Ventes, achats, stocks, facturation et équipe — avec des données réelles, des rôles et des workflows métier.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
