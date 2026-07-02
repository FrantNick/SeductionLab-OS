"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type IngestResponse = { document: { id: string; title: string; chunks: number } };

const PASTE_KINDS = [
  { value: "TEXT", label: "Plain text" },
  { value: "MARKDOWN", label: "Markdown" },
  { value: "SOP", label: "SOP / playbook" },
  { value: "SWIPE", label: "Swipe file" },
  { value: "THREAD", label: "Thread" },
  { value: "BOOK", label: "Book excerpt" },
];

/**
 * Knowledge-base ingestion: upload a file (.pdf/.md/.txt) or paste text.
 * Documents are chunked server-side on ingest (see lib/ai/knowledge).
 */
export function KnowledgeForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      let result: IngestResponse;
      if (mode === "upload") {
        const file = fields.get("file");
        if (!(file instanceof File) || file.size === 0) {
          toast({ kind: "warning", title: "Pick a file first" });
          return;
        }
        // multipart: the API extracts PDF text server-side
        const res = await fetch("/api/ai/knowledge", { method: "POST", body: fields });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new ApiError(res.status, data?.error ?? `Upload failed (${res.status})`);
        }
        result = data as IngestResponse;
      } else {
        result = await api.post<IngestResponse>("/api/ai/knowledge", {
          title: fields.get("title"),
          kind: fields.get("kind"),
          content: fields.get("content"),
          tags: String(fields.get("tags") ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
      }
      toast({
        kind: "success",
        title: `Ingested "${result.document.title}"`,
        description: `${result.document.chunks} chunk(s) ready for retrieval`,
      });
      form.reset();
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Ingestion failed", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-ember-soft text-ember-text" : "text-zinc-400 hover:bg-ink-800 hover:text-zinc-200"
    }`;

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-4">
      <div className="flex gap-1">
        <button type="button" className={tabClass(mode === "upload")} onClick={() => setMode("upload")}>
          Upload file
        </button>
        <button type="button" className={tabClass(mode === "paste")} onClick={() => setMode("paste")}>
          Paste text
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Title</label>
        <input
          name="title"
          className="input"
          placeholder={mode === "upload" ? "Defaults to the file name" : "Document title"}
          required={mode === "paste"}
        />
      </div>

      {mode === "upload" ? (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            File (.pdf, .md, .txt — max 10 MB)
          </label>
          <input
            name="file"
            type="file"
            accept=".pdf,.md,.txt,.markdown,text/plain,text/markdown,application/pdf"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-xs file:text-zinc-200"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Content</label>
          <textarea name="content" className="input min-h-40" required placeholder="Paste the document…" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Kind</label>
          <select name="kind" className="input" defaultValue={mode === "upload" ? "TEXT" : "SOP"}>
            {PASTE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">PDFs are detected automatically.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tags</label>
          <input name="tags" className="input" placeholder="hooks, openers" />
        </div>
      </div>

      <button type="submit" className="btn-primary w-fit" disabled={busy}>
        {busy ? "Ingesting…" : "Ingest document"}
      </button>
    </form>
  );
}
