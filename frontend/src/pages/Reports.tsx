import { api, apiUrl, getToken } from "@/api/client";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { money } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const KINDS = [
  ["sales", "Ventes"],
  ["purchases", "Achats"],
  ["profit", "Bénéfices"],
  ["expenses", "Dépenses"],
  ["stock", "Stocks"],
  ["customers", "Clients"],
  ["suppliers", "Fournisseurs"],
  ["payments", "Paiements"],
  ["unpaid", "Factures impayées"],
];

export default function Reports() {
  const [kind, setKind] = useState("sales");
  const [date_from, setFrom] = useState("");
  const [date_to, setTo] = useState("");
  const [customer_id, setCustomer] = useState("");
  const { data: customers } = useQuery({ queryKey: ["customers-mini"], queryFn: () => api.get<any>("/customers?page_size=100") });
  const qs = `date_from=${date_from}&date_to=${date_to}${customer_id ? `&customer_id=${customer_id}` : ""}`;
  const { data, isLoading } = useQuery({
    queryKey: ["report", kind, date_from, date_to, customer_id],
    queryFn: () => api.get<any>(`/reports/${kind}?${qs}`),
  });

  const download = (format: string) => {
    const url = `${apiUrl}/reports/${kind}?${qs}&export=${format}`;
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${kind}.${format === "xlsx" ? "xlsx" : format}`;
        a.click();
      });
  };

  const rows = data?.rows || [];
  const keys = rows[0] ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object" || rows[0][k] === null) : [];

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle={data?.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => download("csv")}>CSV</Button>
            <Button variant="secondary" onClick={() => download("xlsx")}>Excel</Button>
            <Button variant="secondary" onClick={() => download("pdf")}>PDF</Button>
          </>
        }
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Rapport">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Du"><Input type="date" value={date_from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Au"><Input type="date" value={date_to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Client">
            <Select value={customer_id} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">Tous</option>
              {(customers?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        {data?.totals && (
          <p className="mt-3 text-sm text-slate-500">
            {Object.entries(data.totals).map(([k, v]) => `${k} : ${money(v as number)}`).join("  ·  ")}
          </p>
        )}
      </Card>
      <Card>
        <DataTable
          loading={isLoading}
          empty="Aucune donnée pour ces filtres."
          rows={rows}
          columns={keys.slice(0, 7).map((k) => ({
            key: k,
            header: k,
            render: (r: any) => (typeof r[k] === "number" ? money(r[k]) : String(r[k] ?? "—")),
          }))}
        />
      </Card>
    </div>
  );
}
