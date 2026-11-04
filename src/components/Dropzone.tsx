"use client";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState } from "react";

const ACCEPT = ["application/pdf", "image/png", "image/jpeg"];

function size(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Minimal drag-and-drop file target. Fixed height so choosing a file never shifts the layout. */
export function Dropzone({ label, hint, file, onFile, required }: { label: string; hint: string; file: File | null; onFile: (f: File | null) => void; required?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function take(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setErr("Use a PDF, PNG or JPG file.");
    if (f.size > 8 * 1024 * 1024) return setErr("File is larger than 8 MB.");
    setErr(null);
    onFile(f);
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="label">{label}{required && <span className="text-rose-600"> *</span>}</label>
        <span className="text-[11px] text-zinc-400">{hint}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={`flex h-[72px] items-center gap-3 rounded-md border border-dashed px-3 transition-colors ${
          over ? "border-slate-900 bg-zinc-50" : file ? "border-solid border-zinc-300 bg-white" : "border-zinc-300 bg-zinc-50/60 hover:bg-zinc-50"
        }`}
      >
        <input id={id} ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
        {file ? (
          <>
            {file.type === "application/pdf" ? <FileText className="h-5 w-5 flex-none text-zinc-500" /> : <ImageIcon className="h-5 w-5 flex-none text-zinc-500" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{file.name}</div>
              <div className="num text-[11px] text-zinc-500">{size(file.size)}</div>
            </div>
            <button type="button" aria-label={`Remove ${label}`} onClick={() => { onFile(null); if (input.current) input.current.value = ""; }} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full items-center gap-3 text-left">
            <UploadCloud className="h-5 w-5 flex-none text-zinc-400" />
            <span className="text-[13px] text-zinc-600"><span className="font-medium text-zinc-900">Drop file</span> or browse</span>
          </button>
        )}
      </div>
      <div className="mt-1 h-4 text-[11px] text-rose-700">{err}</div>
    </div>
  );
}
