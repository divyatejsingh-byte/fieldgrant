"use client";
import { useApi } from "./ui";

type H = { status: "healthy" | "degraded"; runtime: { platform: "render" | "local" }; database: { writeLatencyMs: number | null }; disk: { mountPath: string | null; persistent: boolean } };

/** Short label for the live badge. Says "Render" only when the app really runs on Render, and "disk mounted" only when it really is. */
export function healthLabel(h: H | null, error: boolean): { text: string; tone: "ok" | "warn" | "off"; title: string } {
  if (error || (h && h.status !== "healthy")) return { text: "System degraded", tone: "warn", title: "The health check failed: the database or uploads folder is not writable." };
  if (!h) return { text: "Checking system", tone: "off", title: "Checking /api/health" };
  const ms = h.database.writeLatencyMs !== null ? ` · db write ${h.database.writeLatencyMs}ms` : "";
  if (h.runtime.platform === "render") {
    return h.disk.persistent
      ? { text: `Render: Healthy (${h.disk.mountPath} disk mounted)`, tone: "ok", title: `Persistent disk mounted${ms}` }
      : { text: "Render: Healthy (no persistent disk)", tone: "warn", title: `Data resets on restart without a mounted disk${ms}` };
  }
  return { text: "Local: Healthy (local disk)", tone: "ok", title: `Running outside Render${ms}` };
}

/** Unobtrusive system status for the header: queries /api/health every 30s. */
export function HealthBadge({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { data, error } = useApi<H>("/api/health", 30000);
  const l = healthLabel(data, !!error && !data);
  const dot = l.tone === "ok" ? "bg-emerald-500" : l.tone === "warn" ? "bg-amber-500" : "bg-zinc-300";
  return (
    <span title={l.title} className={`inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-600 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {compact ? (l.tone === "ok" && data?.disk.persistent ? "Render disk active" : l.text) : l.text}
    </span>
  );
}
