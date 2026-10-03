import { Empty, Spinner } from "@/components/ui";
import { cn } from "@/utils/format";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => ReactNode;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  empty,
  onRow,
  page,
  pageSize,
  total,
  onPage,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty: string;
  onRow?: (row: T) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
}) {
  return (
    <div>
      <div className="table-wrap">
        <table className="hidden min-w-full text-left text-sm md:table">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <Spinner />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <Empty title={empty} />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRow?.(row)}
                  className={cn("border-b border-slate-50 transition hover:bg-slate-50/80", onRow && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3.5 text-slate-700", c.className)}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="space-y-3 p-3 md:hidden">
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty title={empty} />
          ) : (
            rows.map((row, i) => (
              <button
                key={row.id || i}
                onClick={() => onRow?.(row)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left"
              >
                {columns.slice(0, 4).map((c) => (
                  <div key={c.key} className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-slate-400">{c.header}</span>
                    <span className="font-medium text-slate-800">
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                    </span>
                  </div>
                ))}
              </button>
            ))
          )}
        </div>
      </div>
      {onPage && page && pageSize && total !== undefined && total > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40">
              ←
            </button>
            <button disabled={page * pageSize >= total} onClick={() => onPage(page + 1)} className="rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40">
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
