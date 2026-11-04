"use client";
import { FileText, ImageIcon, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

const ACCEPT = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_EVIDENCE = 5;

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Proof of work is the grantee's choice: attendance list, project photos, a report... any mix of up to five PDF/PNG/JPG files. */
export function EvidencePicker({ files, onChange, required }: { files: File[]; onChange: (f: File[]) => void; required?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  function add(list: FileList | File[]) {
    const next = [...files];
    setErr(null);
    for (const f of Array.from(list)) {
      if (next.length >= MAX_EVIDENCE) { setErr(`You can add up to ${MAX_EVIDENCE} files.`); break; }
      if (!ACCEPT.includes(f.type)) { setErr("Use PDF, PNG or JPG files."); continue; }
      if (f.size > 8 * 1024 * 1024) { setErr(`${f.name} is larger than 8 MB.`); continue; }
      next.push(f);
    }
    onChange(next);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="label">Proof of work{required && <span className="text-rose-600"> *</span>}</label>
        <span className="text-[11px] text-zinc-400">Your choice, up to {MAX_EVIDENCE} files</span>
      </div>
      <p className="mb-2 text-[12px] leading-4 text-zinc-500">An attendance list, photos of the project, a report: send whatever best shows the work was done.</p>
      <input id={id} ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} />
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2">
              {f.type === "application/pdf" ? <FileText className="h-4 w-4 flex-none text-zinc-500" /> : <ImageIcon className="h-4 w-4 flex-none text-zinc-500" />}
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{f.name}</div><div className="num text-[11px] text-zinc-500">{size(f.size)}</div></div>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {files.length < MAX_EVIDENCE && (
        <button type="button" onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
          className="flex h-[56px] w-full items-center gap-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-3 text-left hover:bg-zinc-50">
          <Plus className="h-5 w-5 flex-none text-zinc-400" />
          <span className="text-[13px] text-zinc-600"><span className="font-medium text-zinc-900">{files.length ? "Add another file" : "Add files"}</span> or drop them here</span>
        </button>
      )}
      <div className="mt-1 min-h-4 text-[11px] text-rose-700">{err}</div>
    </div>
  );
}
