"use client";
import { FlaskConical, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNgo, type DraftTranche } from "@/components/AppState";
import { ResetButton } from "@/components/ResetButton";

export type ScenarioRun = { ngoId: string; trancheId: string; snap: DraftTranche; receipt: File; evidence: File[]; memo: string };

const SCENARIOS = [
  { key: "clean", n: 1, label: "Clean release → payout", expect: "Everything checks out: approved, and a PayPal sandbox payout starts.", ngo: /cleanwater/i },
  { key: "overspend", n: 2, label: "30% overspend → hard hold", expect: "A hard check fails: held, with the exact amount to fix.", ngo: /cleanwater/i },
  { key: "injection", n: 3, label: "Prompt injection → security hold", expect: "The hidden instruction is flagged and ignored; a person reviews. Nothing is paid.", ngo: /cleanwater/i },
  { key: "duplicate", n: 4, label: "Cross-NGO duplicate hash → hold", expect: "Another organization already used this exact file: held.", ngo: /healthbridge/i },
  { key: "lowquality", n: 5, label: "Blurred / low confidence → officer review", expect: "The reads are not reliable, so a person decides.", ngo: /cleanwater/i },
] as const;

const sha256 = async (b: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await b.arrayBuffer()))).map((x) => x.toString(16).padStart(2, "0")).join("");

/**
 * One click per demo scenario: loads the exact mock files for the right organization, submits them through the live pipeline
 * and hands the result to the decision area. Each scenario needs an open payment, so after a run use "Reset demo data" to repeat.
 */
export function ScenarioBar({ busy, onRun }: { busy: boolean; onRun: (r: ScenarioRun) => Promise<void> }) {
  const { ngos, setNgoId } = useNgo();
  const [active, setActive] = useState<(typeof SCENARIOS)[number] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; reset?: boolean } | null>(null);

  async function go(s: (typeof SCENARIOS)[number]) {
    setActive(s); setMsg(null); setLoading(s.key);
    try {
      const org = ngos.find((n) => s.ngo.test(n.name));
      if (!org) throw new Error(`The demo organization for this scenario (${s.ngo.source.replace(/\\/g, "")}) was not found. Reset the demo data.`);
      const get = async (f: string) => {
        const r = await fetch(`/api/samples/${s.key}/${f}`);
        if (!r.ok) throw new Error("The sample documents are not available on this server.");
        return r;
      };
      const [rc, ro, me, nd] = await Promise.all([get("receipt.png"), get("roster.pdf"), get("memo.txt"), fetch(`/api/ngos/${org.id}`).then((r) => r.json())]);
      const receiptBlob = await rc.blob();
      const open = (nd.submittable ?? []) as DraftTranche[];
      // The mock documents are written for CleanWater's Community Sanitation tranche 2; the duplicate uses any open HealthBridge payment.
      const tranche = s.key === "duplicate" ? open[0] : open.find((t) => t.grant_name.includes("Community Sanitation") && t.seq === 2);
      if (!tranche) { setMsg({ text: "That payment already has a decision, so it can't take new documents.", reset: true }); return; }
      if (s.key === "duplicate" && !(await (await fetch(`/api/receipts/seen?sha256=${await sha256(receiptBlob)}`)).json()).seen) {
        setMsg({ text: "Run Scenario 1 first: there is no earlier receipt to duplicate yet." }); return;
      }
      setNgoId(String(org.id));
      await onRun({
        ngoId: String(org.id), trancheId: String(tranche.id), snap: tranche,
        receipt: new File([receiptBlob], "receipt.png", { type: "image/png" }),
        evidence: [new File([await ro.blob()], "roster.pdf", { type: "application/pdf" })],
        memo: await me.text(),
      });
    } catch (e) { setMsg({ text: (e as Error).message }); } finally { setLoading(null); }
  }

  return (
    <section className="mb-4 rounded-lg border border-zinc-200/80 bg-white p-3" aria-label="One-click demo scenarios">
      <div className="flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-zinc-500" /><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Demo scenarios · mock documents · live pipeline</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SCENARIOS.map((s) => (
          <button key={s.key} type="button" disabled={busy || !!loading} onClick={() => void go(s)}
            className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${active?.key === s.key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"}`}>
            {loading === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span className="font-mono text-[11px] opacity-70">{s.n}</span>Run: {s.label}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-4 text-[12px] text-zinc-600" aria-live="polite">
        {msg ? <span className="text-amber-800">{msg.text} {msg.reset && <>Use <ResetButton to="/partner/submit" /> to run the scenarios again.</>}</span> : active ? <>Expected: <span className="text-zinc-800">{active.expect}</span></> : "Click a scenario to run it end to end."}
      </p>
    </section>
  );
}
