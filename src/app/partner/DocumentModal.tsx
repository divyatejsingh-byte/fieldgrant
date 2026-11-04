"use client";
import { Link2, Upload } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ErrorBox, emitDataChanged } from "@/components/ui";
import type { CovenantRow } from "@/lib/compliance";
import type { GranteeDocumentRecord } from "@/types/grant";

/**
 * Fulfil one requirement: link a document already in the vault, or add a new one (reference number and/or an uploaded copy).
 * Records are self-declared; the server validates the file type, size and dates but cannot verify authenticity.
 */
export function DocumentModal({
  ngoId, row, vault, names, onClose, onDone,
}: { ngoId: string; row: CovenantRow; vault: GranteeDocumentRecord[]; names: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const [docNumber, setDocNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkFrom, setLinkFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const linkable = vault.filter((v) => v.covenantId !== row.id && v.status === "ACTIVE");

  async function submit(fd: FormData) {
    setBusy(true); setErr(null);
    fd.set("ngo_id", ngoId);
    fd.set("covenant_id", row.id);
    try {
      const r = await fetch("/api/vault", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save the document");
      emitDataChanged();
      onDone();
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const upload = () => {
    const fd = new FormData();
    if (docNumber.trim()) fd.set("doc_number", docNumber.trim());
    if (expiry) fd.set("expiry_date", expiry);
    if (file) fd.set("file", file);
    return submit(fd);
  };
  const link = () => { const fd = new FormData(); fd.set("link_from_covenant_id", linkFrom); return submit(fd); };

  return (
    <Modal title={row.state === "MISSING" ? `Add document · ${row.name}` : `Renew document · ${row.name}`} sub={row.description} onClose={onClose}>
      <div className="space-y-5">
        {linkable.length > 0 && (
          <section aria-label="Link from vault" className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="label mb-2 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Link from vault</div>
            <div className="flex flex-wrap gap-2">
              <select className="field min-w-0 flex-1" value={linkFrom} onChange={(e) => setLinkFrom(e.target.value)} aria-label="Vault document">
                <option value="">Choose a document you already hold</option>
                {linkable.map((v) => <option key={v.covenantId} value={v.covenantId}>{names[v.covenantId] ?? v.covenantId}{v.docNumber ? ` · ${v.docNumber}` : ""}{v.expiryDate ? ` · exp ${v.expiryDate}` : ""}</option>)}
              </select>
              <button type="button" className="btn-secondary" disabled={!linkFrom || busy} onClick={link}>Link</button>
            </div>
          </section>
        )}

        <section aria-label="Upload new document">
          <div className="label mb-2 flex items-center gap-1.5"><Upload className="h-3 w-3" /> {linkable.length > 0 ? "Or upload a new document" : "Upload new document"}</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] text-zinc-600" htmlFor="doc-ref">Document reference or number</label>
              <input id="doc-ref" className="field num" value={docNumber} maxLength={60} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. registration or certificate number" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] text-zinc-600" htmlFor="doc-exp">Expiry date <span className="text-zinc-400">(if it expires)</span></label>
                <input id="doc-exp" type="date" className="field num" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-zinc-600" htmlFor="doc-file">Copy of the document <span className="text-zinc-400">(PDF, PNG or JPG)</span></label>
                <input id="doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg" className="block w-full text-[12px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">Enter a reference, upload a copy, or both. This prototype records what you declare; it does not check documents against official registries.</p>
          </div>
        </section>

        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || (!docNumber.trim() && !file)} onClick={upload}>{busy ? "Saving..." : "Save to vault"}</button>
        </div>
      </div>
    </Modal>
  );
}
