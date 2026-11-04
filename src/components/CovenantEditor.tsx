"use client";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { countryName, getStandardCovenant, listCatalog, SUBCATEGORY_LABEL, covenantSource } from "@/lib/compliance-catalog";
import type { CovenantRow } from "@/lib/compliance";
import type { CovenantDefinition, CustomSubcategory } from "@/types/grant";
import { Modal } from "./Modal";
import { Badge, ErrorBox, Skeleton, emitDataChanged, useApi } from "./ui";

type Resp = {
  grant: { id: number; name: string };
  funder: { id: number; name: string; country: string };
  ngo: { id: number; name: string; country: string };
  covenants: CovenantDefinition[];
  rows: CovenantRow[];
  suggested: CovenantDefinition[];
};

const SUBS = Object.keys(SUBCATEGORY_LABEL) as CustomSubcategory[];

/**
 * Funder-side contract configuration: pick recognised statutory/governance documents (with a location-aware preset),
 * add custom covenants, and mark each as payout-blocking or advisory. The server re-validates everything on save.
 */
export function CovenantEditor({ grantId, onClose, onSaved }: { grantId: number; onClose: () => void; onSaved: () => void }) {
  const { data, error } = useApi<Resp>(`/api/grants/${grantId}/compliance`);
  const [list, setList] = useState<CovenantDefinition[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sub, setSub] = useState<CustomSubcategory>("OPERATIONAL");
  const [blocking, setBlocking] = useState(true);
  const [desc, setDesc] = useState("");

  useEffect(() => { if (data && list === null) setList(data.covenants); }, [data, list]);

  const has = (id: string) => !!list?.some((c) => c.id === id);
  const add = (c: CovenantDefinition) => setList((l) => (l && !l.some((x) => x.id === c.id) ? [...l, c] : l));
  const remove = (id: string) => setList((l) => l?.filter((c) => c.id !== id) ?? l);
  const toggleStd = (id: string) => (has(id) ? remove(id) : add(getStandardCovenant(id)!));
  const setBlock = (id: string, b: boolean) => setList((l) => l?.map((c) => (c.id === id ? { ...c, blocking: b } : c)) ?? l);

  const missingSuggested = (data?.suggested ?? []).filter((s) => !has(s.id));
  const state = (id: string) => data?.rows.find((r) => r.id === id)?.state;

  function addCustom() {
    const n = name.replace(/\s+/g, " ").trim();
    if (n.length < 3) return setErr("Give the custom covenant a name of at least 3 characters.");
    if (list?.some((c) => c.name.toLowerCase() === n.toLowerCase())) return setErr("That covenant is already on the list.");
    setErr(null);
    add({ id: crypto.randomUUID(), name: n, category: "CUSTOM", isCustom: true, subcategory: sub, blocking, ...(desc.trim() ? { description: desc.trim() } : {}) });
    setName(""); setDesc(""); setBlocking(true);
  }

  async function save() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/grants/${grantId}/covenants`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ covenants: list }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save covenants");
      emitDataChanged();
      onSaved();
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  const title = data ? `Compliance covenants · ${data.grant.name}` : "Compliance covenants";
  return (
    <Modal title={title} sub="Requirements the grantee must hold before any tranche can be released. Checked automatically as Gate 1, before documents are read." onClose={onClose} wide>
      {error && <ErrorBox message={error} />}
      {!data || !list ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-600">
            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">{data.funder.name} · {data.funder.country}</span>
            <span aria-hidden>→</span>
            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">{data.ngo.name} · {data.ngo.country}</span>
          </div>

          {/* Presets */}
          <section aria-label="Presets">
            <div className="label mb-1.5">Presets</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" disabled={missingSuggested.length === 0} onClick={() => missingSuggested.forEach(add)}>
                {countryName(data.funder.country)} Funder + {countryName(data.ngo.country)} Grantee Preset
                <span className="num text-[11px] text-zinc-500">{missingSuggested.length ? `+${missingSuggested.length}` : "applied"}</span>
              </button>
              {missingSuggested.map((s) => (
                <button key={s.id} type="button" onClick={() => add(s)} className="inline-flex h-7 items-center gap-1 rounded-full border border-zinc-200/80 bg-white px-2.5 text-[12px] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50">
                  <Plus className="h-3 w-3" />{s.name}
                </button>
              ))}
            </div>
          </section>

          {/* Multi-select from the catalog */}
          <section aria-label="Catalog">
            <div className="label mb-1.5">Standard catalog</div>
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="field flex items-center justify-between text-left">
              <span>Select recognised documents <span className="num text-zinc-500">({list.filter((c) => !c.isCustom).length} selected)</span></span>
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-zinc-200">
                {listCatalog().map((g) => (
                  <fieldset key={g.region} className="border-b border-zinc-100 last:border-0">
                    <legend className="label w-full bg-zinc-50 px-3 py-1.5">{g.label}</legend>
                    {g.covenants.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-[13px] hover:bg-zinc-50">
                        <input type="checkbox" className="mt-0.5" checked={has(c.id)} onChange={() => toggleStd(c.id)} />
                        <span><span className="font-medium">{c.name}</span><span className="block text-[11px] text-zinc-500">{c.description}</span></span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          </section>

          {/* Custom covenant */}
          <section aria-label="Custom covenant" className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="label mb-2">+ Add custom covenant</div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <input className="field" placeholder="e.g. M&E Baseline Study Sign-Off" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Custom covenant name" />
              <select className="field" value={sub} onChange={(e) => setSub(e.target.value as CustomSubcategory)} aria-label="Category">
                {SUBS.map((s) => <option key={s} value={s}>{SUBCATEGORY_LABEL[s]}</option>)}
              </select>
            </div>
            <input className="field mt-2" placeholder="Description (optional)" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[12px] text-zinc-700"><input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} /> Payout blocking <span className="text-zinc-400">(a missing document HOLDs the tranche)</span></label>
              <button type="button" className="btn-secondary" onClick={addCustom}><Plus className="h-3.5 w-3.5" /> Add</button>
            </div>
          </section>

          {/* Live list */}
          <section aria-label="Active requirements">
            <div className="mb-1.5 flex items-baseline justify-between"><span className="label">Active requirements</span><span className="num text-[11px] text-zinc-500">{list.length}</span></div>
            {list.length === 0 ? <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-[12px] text-zinc-500">No covenants: this grant is not gated on compliance documents.</p> : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {list.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{c.name}</div>
                      <div className="text-[11px] text-zinc-500">{covenantSource(c)}{c.isCustom && c.subcategory ? ` · ${SUBCATEGORY_LABEL[c.subcategory]}` : ""}</div>
                    </div>
                    {state(c.id) && <Badge status={state(c.id)} />}
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-600"><input type="checkbox" checked={c.blocking !== false} onChange={(e) => setBlock(c.id, e.target.checked)} /> Blocks payout</label>
                    <button type="button" onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`} className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-400">Changes apply to future submissions. Statuses shown are the grantee&apos;s current vault; records are self-declared and not verified against registries.</p>
          </section>

          {err && <ErrorBox message={err} />}
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save covenants"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
