"use client";
import type { ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef } from "react";
import { centsFormatter, gridTheme } from "./grid";
import { Badge } from "./ui";

export type ReviewItem = {
  id: number; decision: string; decision_reason: string; ngo_name: string; grant_name: string; seq: number; amount_cents: number;
  tranche_status: string; llm_explanation: string | null;
};

const mono = "font-mono text-xs font-medium text-zinc-700";

/** The officer's queue. Selecting a row (click or arrow keys) drives the decision panel next to it. */
export function ReviewQueueGrid({ items, selectedId, onSelect }: { items: ReviewItem[]; selectedId: number | null; onSelect: (id: number | null) => void }) {
  const grid = useRef<AgGridReact<ReviewItem>>(null);
  const cols = useMemo<ColDef<ReviewItem>[]>(() => [
    { field: "ngo_name", headerName: "Organization", flex: 1.3, minWidth: 160 },
    { field: "grant_name", headerName: "Grant", flex: 1.5, minWidth: 180 },
    { field: "seq", headerName: "Tranche", width: 100, valueFormatter: (p) => `T${p.value}`, cellClass: mono },
    { field: "amount_cents", headerName: "Amount", width: 120, valueFormatter: centsFormatter, type: "rightAligned", cellClass: mono },
    { field: "decision", headerName: "Why it's here", width: 160, enableCellChangeFlash: true, cellRenderer: (p: ICellRendererParams<ReviewItem>) => <Badge status={p.value} /> },
  ], []);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Waiting for a decision">
      <header className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-2.5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Waiting for a decision</h2>
        <span className="font-mono text-[11px] text-zinc-500">{items.length}</span>
      </header>
      <div style={{ height: Math.min(440, 40 * (items.length + 1) + 6) }}>
        <AgGridReact<ReviewItem>
          ref={grid}
          theme={gridTheme}
          rowData={items}
          columnDefs={cols}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          getRowId={(p) => String(p.data.id)}
          rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
          onSelectionChanged={(e: SelectionChangedEvent<ReviewItem>) => onSelect(e.api.getSelectedRows()[0]?.id ?? null)}
          onFirstDataRendered={(e) => { e.api.getRowNode(String(selectedId ?? items[0]?.id))?.setSelected(true); }}
          suppressCellFocus
        />
      </div>
    </section>
  );
}
