"use client";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { centsFormatter, gridTheme } from "@/components/grid";
import { Badge, Skeleton } from "@/components/ui";
import { usePartner } from "./layout";

type Row = { trancheId: number; funder: string; grant: string; seq: number; amount_cents: number; status: string; actionable: boolean };

/** Every payment across every funder in one sortable, filterable table. Rows that need documents open the uploader. */
export function PaymentsGrid() {
  const { overview: o } = usePartner();
  const router = useRouter();
  const rows = useMemo<Row[]>(() => (o?.funders ?? []).flatMap((f) => f.grants.flatMap((g) => g.tranches.map((t) => ({
    trancheId: t.id, funder: f.foundation.name, grant: g.name, seq: t.seq, amount_cents: t.amount_cents, status: t.status,
    actionable: f.actionable.some((a) => a.trancheId === t.id),
  })))), [o]);

  const cols = useMemo<ColDef<Row>[]>(() => [
    { field: "funder", headerName: "Funder", flex: 1.2, minWidth: 160 },
    { field: "grant", headerName: "Grant", flex: 1.6, minWidth: 200 },
    { field: "seq", headerName: "Payment", width: 110, valueFormatter: (p) => `Tranche ${p.value}`, filter: "agNumberColumnFilter" },
    { field: "amount_cents", headerName: "Amount", width: 130, valueFormatter: centsFormatter, type: "rightAligned", filter: "agNumberColumnFilter", cellClass: "num" },
    { field: "status", headerName: "Where it stands", width: 190, enableCellChangeFlash: true, cellRenderer: (p: ICellRendererParams<Row>) => <Badge status={p.value} /> },
    { headerName: "Next step", width: 170, valueGetter: (p) => (p.data?.actionable ? "Send documents" : ""), cellClass: "font-medium text-emerald-700" },
  ], []);

  if (!o) return <Skeleton className="h-64 w-full" />;
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="All your payments">
      <header className="border-b border-zinc-200 px-4 py-2.5 text-[14px] font-semibold">All your payments <span className="ml-1 text-[12px] font-normal text-zinc-500">click a row that says “Send documents” to start</span></header>
      <div style={{ height: Math.min(460, 38 * (rows.length + 1) + 6) }}>
        <AgGridReact<Row>
          theme={gridTheme}
          rowData={rows}
          columnDefs={cols}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          getRowId={(p) => String(p.data.trancheId)}
          rowClassRules={{ "fg-row-link": (p) => !!p.data?.actionable }}
          onRowClicked={(e) => { if (e.data?.actionable) router.push(`/partner/submit?tranche=${e.data.trancheId}`); }}
          suppressCellFocus
        />
      </div>
    </section>
  );
}
