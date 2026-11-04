import { getDb, handle } from "@/lib/api";
import { getVault, parseCovenants, upsertVaultRecord } from "@/lib/compliance";
import { PayoutError } from "@/lib/payout/service";
import { storeUpload } from "@/lib/uploads";
import type { GranteeDocumentRecord } from "@/types/grant";

export const dynamic = "force-dynamic";

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const isRealDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

export const GET = (req: Request) =>
  handle(() => {
    const id = Number(new URL(req.url).searchParams.get("ngo_id"));
    if (!Number.isInteger(id)) throw new PayoutError("ngo_id is required.", 400);
    return { vault: getVault(getDb(), id) };
  });

/**
 * Add, renew or link a document in the grantee's vault (multipart). SELF-DECLARED: nothing here verifies a document
 * against an official registry. The requirement must be a covenant on one of this NGO's grants, so the vault cannot be
 * stuffed with arbitrary ids. Free text is length-limited and control characters stripped.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const db = getDb();
    const f = await req.formData();
    const ngoId = Number(f.get("ngo_id"));
    const covenantId = clean(f.get("covenant_id"), 64);
    if (!Number.isInteger(ngoId) || !db.prepare("SELECT 1 FROM ngo WHERE id=?").get(ngoId)) throw new PayoutError("A valid ngo_id is required.", 400);

    const required = (db.prepare("SELECT covenants FROM grant_award WHERE ngo_id=?").all(ngoId) as { covenants: string }[]).flatMap((g) => parseCovenants(g.covenants));
    if (!required.some((c) => c.id === covenantId)) throw new PayoutError("That requirement is not part of any of this organisation's grants.", 400);

    const expiry = clean(f.get("expiry_date"), 10);
    if (expiry && !isRealDate(expiry)) throw new PayoutError("Expiry date must be a real date (yyyy-mm-dd).", 400);

    const linkFrom = clean(f.get("link_from_covenant_id"), 64);
    const file = f.get("file");
    const docNumber = clean(f.get("doc_number"), 60);

    let rec: GranteeDocumentRecord = { covenantId, status: "ACTIVE", addedAt: new Date().toISOString() };
    if (linkFrom) {
      // Re-use a document already in the vault for another requirement.
      const src = getVault(db, ngoId).find((v) => v.covenantId === linkFrom);
      if (!src) throw new PayoutError("The document you tried to link does not exist in your vault.", 400);
      rec = { ...rec, docNumber: src.docNumber, expiryDate: src.expiryDate, fileName: src.fileName, fileHash: src.fileHash, issuedDate: src.issuedDate };
    } else {
      if (!docNumber && !(file instanceof File && file.size > 0)) throw new PayoutError("Enter a document reference or upload the document.", 400);
      if (docNumber) rec.docNumber = docNumber;
      if (file instanceof File && file.size > 0) {
        const stored = storeUpload(Buffer.from(await file.arrayBuffer()), "compliance document"); // PDF/PNG/JPG only, size-limited, hashed
        rec.fileHash = stored.sha256;
        rec.fileName = clean(file.name.split(/[\/]/).pop(), 80) || "document";
      }
    }
    if (expiry) rec.expiryDate = expiry;
    return { vault: upsertVaultRecord(db, ngoId, rec) };
  });
