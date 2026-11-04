"use client";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Download, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ledgerDetail } from "@/lib/ledger-detail";
import { centsFormatter, gridTheme as theme, useSavedLayout } from "./grid";
import { IdButton } from "./RailInspector";
import { Badge, DATA_CHANGED, ErrorBox, Skeleton, useApi } from "./ui";

export type LedgerRow = {
  id: number; created_at: string; ngo: string; grant_name: string; tranche: number; event_type: string; actor: string;
  status: string | null; payout_batch_id: string | null; payout_item_id: string | null; is_seeded: number; submission_id: number | null;
  /** The submission's current decision band (RELEASE | OFFICER_REVIEW | HOLD). Null for rows with no submission (seeded history). */
  band: string | null;
  amount_cents: number | null;
  /** Settlement state of the tranche: RELEASING flips to PAID when PayPal confirms. */
  tranche_status: string | null;
  payload?: string;
};

const mono = "font-mono text-xs font-medium text-zinc-700";

const detail = (r: LedgerRow) => ledgerDetail(r.event_type, r.payload);

const TABS: { key: string; label: string; test: (r: LedgerRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "released", label: "Auto-Released", test: (r) => r.band === "RELEASE" },
  { key: "review", label: "Review Queue", test: (r) => r.band === "OFFICER_REVIEW" },
  { key: "held", label: "Holds", test: (r) => r.band === "HOLD" },
  { key: "dispatched", label: "PayPal Dispatched", test: (r) => !!r.payout_batch_id },
];
type TabKey = string;

/**
 * Institutional ledger shell around the AG Grid audit trail. Tabs filter by the decision band of the row's submission;
 * seeded history rows (no submission) appear under "All" only.
 */
export function LedgerGrid({
  ngoId, foundationId, compact = false, height = 560, refreshMs = 5000, ngoFilter = true, title = "Grant Disbursement & Compliance Ledger",
}: { ngoId?: string; foundationId?: string; compact?: boolean; height?: number | string; refreshMs?: number; ngoFilter?: boolean; title?: string }) {
  const ngos = useApi<{ id: number; name: string }[]>(ngoFilter ? "/api/ngos" : null);
  const [localNgo, setLocalNgo] = useState("");
  const ngo = ngoId ?? localNgo;
  const qs = [ngo ? `ngo_id=${ngo}` : "", foundationId ? `foundation_id=${foundationId}` : ""].filter(Boolean).join("&");
  const { data, error, loading, reload } = useApi<LedgerRow[]>(`/api/ledger${qs ? `?${qs}` : ""}`, refreshMs);
  useEffect(() => { const h = () => void reload(); window.addEventListener(DATA_CHANGED, h); return () => window.removeEventListener(DATA_CHANGED, h); }, [reload]);
  const grid = useRef<AgGridReact<LedgerRow>>(null);
  const router = useRouter();
  const layout = useSavedLayout("ledger" + (compact ? "-compact" : ""), grid);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [shown, setShown] = useState<number | null>(null);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) ?? TABS[0];
    return (data ?? []).filter(t.test);
  }, [data, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, (data ?? []).filter(t.test).length])), [data]);

  const cols = useMemo<ColDef<LedgerRow>[]>(() => [
    { field: "created_at", headerName: "Time (UTC)", width: 150, sort: "desc", cellClass: mono },
    { field: "ngo", headerName: "NGO", width: 190, hide: compact && !!ngoId },
    { field: "grant_name", headerName: "Grant", width: 210, hide: compact },
    { field: "tranche", headerName: "Tr.", width: 62, filter: "agNumberColumnFilter", cellClass: mono },
    { field: "amount_cents", headerName: "Amount", colId: "amount_cents", width: 120, type: "rightAligned", filter: "agNumberColumnFilter", valueFormatter: centsFormatter, cellClass: mono, hide: compact },
    { field: "event_type", headerName: "Event", width: 190, cellClass: mono },
    { field: "actor", headerName: "Actor", width: 96 },
    { field: "band", headerName: "Decision", width: 150, hide: compact, enableCellChangeFlash: true, cellRenderer: (p: ICellRendererParams<LedgerRow>) => <Badge status={p.value} /> },
    { field: "status", headerName: "Status", width: 150, enableCellChangeFlash: true, cellRenderer: (p: ICellRendererParams<LedgerRow>) => <Badge status={p.value} /> },
    { field: "tranche_status", headerName: "Settlement", width: 170, enableCellChangeFlash: true, cellRenderer: (p: ICellRendererParams<LedgerRow>) => <Badge status={p.value} /> },
    { field: "payout_batch_id", headerName: "payout_batch_id", width: 200, cellRenderer: (p: ICellRendererParams<LedgerRow>) => <IdButton value={p.value} batchId={p.data?.payout_batch_id} /> },
    { field: "payout_item_id", headerName: "payout_item_id", width: 200, hide: compact, cellRenderer: (p: ICellRendererParams<LedgerRow>) => <IdButton value={p.value} batchId={p.data?.payout_batch_id} /> },
    { headerName: "Detail", width: 340, hide: compact, valueGetter: (p) => (p.data ? detail(p.data) : ""), tooltipValueGetter: (p) => (p.data ? detail(p.data) : ""), cellClass: "text-xs text-zinc-600" },
    { field: "is_seeded", headerName: "Source", width: 130, valueFormatter: (p) => (p.value ? "Seeded example" : "Live"), filter: "agTextColumnFilter" },
  ], [compact, ngoId]);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label={title}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
          <span className="font-mono text-[11px] text-zinc-500" aria-live="polite">{(shown ?? rows.length).toLocaleString("en-US")} {(shown ?? rows.length) === 1 ? "row" : "rows"}</span>
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live · {refreshMs / 1000}s</span>
      </header>

      <div className="grid items-center gap-x-3 gap-y-2 border-b border-zinc-200/80 px-4 py-2.5 lg:grid-cols-[auto_1fr_auto]">
        <div role="tablist" aria-label="Filter the ledger" className="flex flex-wrap rounded-md border border-zinc-200/80 bg-zinc-50 p-0.5 text-xs font-medium">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors ${tab === t.key ? "bg-white text-zinc-900 shadow-[0_0_0_1px_#e4e4e7]" : "text-zinc-500 hover:text-zinc-900"}`}>
              {t.label}<span className={`font-mono text-[10px] ${tab === t.key ? "text-zinc-500" : "text-zinc-400"}`}>{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          {ngoFilter && ngoId === undefined && (
            <select value={localNgo} onChange={(e) => setLocalNgo(e.target.value)} className="field h-8 w-auto text-xs" aria-label="NGO filter">
              <option value="">All NGOs</option>
              {ngos.data?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-[9px] h-3.5 w-3.5 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ledger in real time" className="field h-8 w-64 pl-8 text-xs" aria-label="Search ledger" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary h-8 text-xs" onClick={layout.reset} title="Restore the default columns, order and filters"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <button className="btn-primary h-8 text-xs" onClick={() => grid.current?.api.exportDataAsCsv({
            fileName: "fieldgrant-audit-ledger.csv",
            // Money is stored as integer cents; the export carries the same formatted USD the grid shows.
            processCellCallback: (c) => (c.column.getColId() === "amount_cents" ? centsFormatter({ value: c.value as number | null }) : c.value),
          })}>
            <Download className="h-3.5 w-3.5" /> Export Audit CSV
          </button>
        </div>
      </div>

      {error && <div className="p-3"><ErrorBox message={error} /></div>}
      <div style={{ height }}>
        {loading && !data ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <AgGridReact<LedgerRow>
            ref={grid}
            theme={theme}
            rowData={rows}
            columnDefs={cols}
            quickFilterText={q}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            pagination
            paginationPageSize={25}
            paginationPageSizeSelector={false}
            getRowId={(p) => String(p.data.id)}
            suppressCellFocus
            onGridReady={layout.restore}
            onColumnMoved={layout.save}
            onColumnResized={(e) => e.finished && layout.save()}
            onSortChanged={layout.save}
            onColumnVisible={layout.save}
            onRowClicked={(e) => { if (e.data?.submission_id) router.push(`/submissions/${e.data.submission_id}`); }}
            rowClassRules={{ "fg-row-link": (p) => !!p.data?.submission_id, "fg-row-hold": (p) => p.data?.band === "HOLD", "fg-row-review": (p) => p.data?.band === "OFFICER_REVIEW" }}
            tooltipShowDelay={400}
            onModelUpdated={(e) => setShown(e.api.getDisplayedRowCount())}
          />
        )}
      </div>
    </section>
  );
}
