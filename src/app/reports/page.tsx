"use client";
import { useFunder } from "@/components/AppState";
import { ReportsGrid } from "@/components/ReportsGrid";
import { ErrorBox, PageHeader, Skeleton, useApi } from "@/components/ui";
import type { ReportRow } from "@/lib/reports";

/** Funder view: every report the grantees on this funder's grants have shared. */
export default function FunderReports() {
  const { funder, funderId } = useFunder();
  const { data, error, loading } = useApi<ReportRow[]>(funderId ? `/api/reports?foundation_id=${funderId}` : null, 10000);
  const rows = data ?? [];
  const orgs = new Set(rows.map((r) => r.ngo_id)).size;
  return (
    <>
      <PageHeader title="Reports from your grantees" sub={`Progress reports shared with ${funder?.name ?? "you"}, newest first. Open any report to read it.`} />
      {error && <ErrorBox message={error} />}
      {loading && !data ? <Skeleton className="h-48 w-full" /> : (
        <>
          <p className="mb-3 text-[13px] text-zinc-600">{rows.length === 0 ? "No reports have been shared yet." : `${rows.length} report${rows.length === 1 ? "" : "s"} from ${orgs} organization${orgs === 1 ? "" : "s"}.`}</p>
          <ReportsGrid rows={rows} showNgo height={520} />
        </>
      )}
    </>
  );
}
