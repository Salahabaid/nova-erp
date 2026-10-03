import { api, apiUrl, getToken } from "@/api/client";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Line, Page } from "@/types";
import { money } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Kind = "quotes" | "sales-orders" | "purchases" | "invoices";

const itemKey: Record<Kind, string> = {
  quotes: "quote_items",
  "sales-orders": "sales_order_items",
  purchases: "purchase_order_items",
  invoices: "invoice_items",
};

export function DocumentEditor({
  kind,
  initial,
  partyKind,
  onSaved,
}: {
  kind: Kind;
  initial?: any;
  partyKind: "customers" | "suppliers";
  onSaved: (doc: any) => void;
}) {
  const parties = useQuery({ queryKey: [partyKind], queryFn: () => api.get<Page<any>>(`/${partyKind}?page_size=100`) });
  const products = useQuery({ queryKey: ["products-all"], queryFn: () => api.get<Page<any>>("/products?page_size=100") });
  const [partyId, setPartyId] = useState(initial?.customer_id || initial?.supplier_id || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [discount, setDiscount] = useState(Number(initial?.discount || 0));
  const [invoiceType, setInvoiceType] = useState(initial?.invoice_type || "sales");
  const [items, setItems] = useState<Line[]>(
    (initial?.[itemKey[kind]] || []).map((i: any) => ({
      product_id: i.product_id,
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      tax_rate: Number(i.tax_rate),
      discount: Number(i.discount || 0),
    }))
  );

  const addLine = () => setItems((s) => [...s, { description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount: 0 }]);
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    items.forEach((i) => {
      const ht = i.quantity * i.unit_price - (i.discount || 0);
      subtotal += ht;
      tax += ht * (i.tax_rate / 100);
    });
    const after = Math.max(subtotal - discount, 0);
    const ratio = subtotal ? after / subtotal : 0;
    return { subtotal, tax: tax * ratio, total: after + tax * ratio };
  }, [items, discount]);

  const pickProduct = (idx: number, id: string) => {
    const p = products.data?.items.find((x) => x.id === id);
    setItems((s) => s.map((l, i) => (i === idx ? { ...l, product_id: id, description: p?.name || l.description, unit_price: kind === "purchases" || invoiceType === "purchase" ? Number(p?.purchase_price || 0) : Number(p?.sale_price || 0), tax_rate: Number(p?.tax_rate || 20) } : l)));
  };

  const submit = async () => {
    if (!partyId) return toast.error("Sélectionnez un tiers.");
    if (!items.length) return toast.error("Ajoutez au moins une ligne.");
    const payload: any = {
      items,
      notes,
      discount,
      [partyKind === "customers" ? "customer_id" : "supplier_id"]: partyId,
    };
    if (kind === "invoices") payload.invoice_type = invoiceType;
    try {
      const doc = initial?.id
        ? await api.patch(`/${kind}/${initial.id}`, payload)
        : await api.post(`/${kind}`, payload);
      toast.success(initial?.id ? "Document mis à jour." : "Document créé avec succès.");
      onSaved(doc);
    } catch (e: any) {
      toast.error(e.message || "Impossible d'enregistrer le document.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === "invoices" && !initial?.id && (
          <Field label="Type">
            <Select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
              <option value="sales">Facture client</option>
              <option value="purchase">Facture fournisseur</option>
            </Select>
          </Field>
        )}
        <Field label={partyKind === "customers" ? "Client" : "Fournisseur"} required>
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Sélectionner</option>
            {(parties.data?.items || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Remise document">
          <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </Field>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Produit</th>
              <th className="px-3 py-2">Qté</th>
              <th className="px-3 py-2">PU</th>
              <th className="px-3 py-2">TVA</th>
              <th className="px-3 py-2">Remise</th>
              <th className="px-3 py-2">HT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((line, idx) => (
              <tr key={idx} className="border-t border-slate-50">
                <td className="px-2 py-2">
                  <Select value={line.product_id || ""} onChange={(e) => pickProduct(idx, e.target.value)}>
                    <option value="">Libre</option>
                    {(products.data?.items || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Input className="mt-1" value={line.description} onChange={(e) => setItems((s) => s.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} />
                </td>
                <td className="px-2 py-2 w-24"><Input type="number" value={line.quantity} onChange={(e) => setItems((s) => s.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) } : l))} /></td>
                <td className="px-2 py-2 w-28"><Input type="number" value={line.unit_price} onChange={(e) => setItems((s) => s.map((l, i) => i === idx ? { ...l, unit_price: Number(e.target.value) } : l))} /></td>
                <td className="px-2 py-2 w-20"><Input type="number" value={line.tax_rate} onChange={(e) => setItems((s) => s.map((l, i) => i === idx ? { ...l, tax_rate: Number(e.target.value) } : l))} /></td>
                <td className="px-2 py-2 w-24"><Input type="number" value={line.discount} onChange={(e) => setItems((s) => s.map((l, i) => i === idx ? { ...l, discount: Number(e.target.value) } : l))} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{money(line.quantity * line.unit_price - line.discount)}</td>
                <td><button type="button" className="px-2 text-rose-500" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" onClick={addLine}>Ajouter une ligne</Button>
      <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm">
        <p>Sous-total HT {money(totals.subtotal)}</p>
        <p>Remise {money(discount)}</p>
        <p>TVA {money(totals.tax)}</p>
        <p className="mt-1 text-lg font-extrabold">Total TTC {money(totals.total)}</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit}>Enregistrer</Button>
      </div>
    </div>
  );
}

export async function openPdf(id: string) {
  const blob = await (await fetch(`${apiUrl}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } })).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
