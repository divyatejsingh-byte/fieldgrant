"use client";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { REPORT_META, type ReportRow, type ReportType } from "@/lib/reports";
import { gridTheme } from "./grid";

const TYPE_STYLE: Record<ReportType, string> = {
  MONTHLY: "bg-sky-100 text-sky-800",
  QUARTERLY: "bg-slate-100 text-slate-800",
  ANNUAL: "bg-emerald-100 text-emerald-800",
};
const FILTERS: { key: ReportType | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "MONTHLY", label: "Monthly" }, { key: "QUARTERLY", label: "Quarterly" }, { key: "ANNUAL", label: "Annual" },
];

/** Reports shared by grantees, newest first. The same grid serves both sides: the grantee sees their own, the funder sees those on its grants. */
export function ReportsGrid({ rows, showNgo, showFunder, height = 360 }: { rows: ReportRow[]; showNgo?: boolean; showFunder?: boolean; height?: number }) {
  const [type, setType] = useState<ReportType | "ALL">("ALL");
  const [q, setQ] = useState("");
  const shown = useMemo(() => rows.filter((r) => type === "ALL" || r.period_type === type), [rows, type]);

  const cols = useMemo<ColDef<ReportRow>[]>(() => [
    { field: "period_type", headerName: "Type", width: 130, cellRenderer: (p: ICellRendererParams<ReportRow>) => p.value ? <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${TYPE_STYLE[p.value as ReportType]}`}>{REPORT_META[p.value as ReportType].label.replace(" report", "")}</span> : null },
    { field: "period_label", headerName: "Period", width: 110 },
    { field: "ngo_name", headerName: "Organization", flex: 1.2, minWidth: 160, hide: !showNgo },
    { field: "grant_name", headerName: "Grant", flex: 1.4, minWidth: 180 },
    { field: "funder_name", headerName: "Funder", flex: 1, minWidth: 150, hide: !showFunder },
    { field: "created_at", headerName: "Shared on", width: 160, sort: "desc", cellClass: "num" },
    { field: "note", headerName: "Note", flex: 1.4, minWidth: 180, tooltipField: "note" },
    { headerName: "", width: 110, sortable: false, filter: false, cellRenderer: (p: ICellRendererParams<ReportRow>) => p.data ? (
      <a href={`/api/reports/${p.data.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 underline underline-offset-2">Open <ExternalLink className="h-3 w-3" /></a>
    ) : null },
  ], [showNgo, showFunder]);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Reports">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2.5">
        <div role="tablist" aria-label="Report type" className="flex rounded-md border border-zinc-200/80 bg-white p-0.5 text-[13px] font-medium">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={type === f.key} onClick={() => setType(f.key)}
              className={`rounded px-3 py-1 transition-colors ${type === f.key ? "bg-slate-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}>{f.label}</button>
          ))}
        </div>
        <span className="text-[12px] text-zinc-500" aria-live="polite">{shown.length} {shown.length === 1 ? "report" : "reports"}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports" aria-label="Search reports" className="field ml-auto h-8 w-full max-w-60 text-[13px]" />
      </header>
      <div style={{ height: shown.length === 0 ? 120 : Math.min(height, 38 * (shown.length + 1) + 8) }}>
        <AgGridReact<ReportRow>
          theme={gridTheme}
          rowData={shown}
          columnDefs={cols}
          quickFilterText={q}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          getRowId={(p) => String(p.data.id)}
          overlayNoRowsTemplate='<span style="color:#71717a">No reports yet.</span>'
          suppressCellFocus
          tooltipShowDelay={400}
        />
      </div>
    </section>
  );
}
