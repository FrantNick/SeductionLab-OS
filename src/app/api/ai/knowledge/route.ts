import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeKind } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { ingestDocument } from "@/lib/ai/knowledge";

export const maxDuration = 60;

const VALID_KINDS: KnowledgeKind[] = ["PDF", "MARKDOWN", "TEXT", "SOP", "THREAD", "SWIPE", "BOOK"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/ai/knowledge — ingest a knowledge-base document.
 * multipart/form-data: file (+ title, kind, tags) — .md/.txt/.pdf
 * application/json: { title, kind, content, tags }
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAdmin();

  const contentType = req.headers.get("content-type") ?? "";

  let title: string;
  let kind: KnowledgeKind;
  let content: string;
  let tags: string[] = [];
  let sizeBytes = 0;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "No file provided");
    if (file.size > MAX_UPLOAD_BYTES) return jsonError(400, "File exceeds 10 MB limit");

    sizeBytes = file.size;
    title = String(form.get("title") || file.name);
    const rawKind = String(form.get("kind") || "").toUpperCase();
    tags = String(form.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      kind = "PDF";
      try {
        // pdf-parse is CommonJS; dynamic import keeps it out of edge bundles.
        const { default: pdfParse } = await import("pdf-parse");
        const parsed = await pdfParse(buffer);
        content = parsed.text.trim();
      } catch (err) {
        console.error("[knowledge] PDF extraction failed", err);
        return jsonError(422, "Could not extract text from this PDF");
      }
    } else {
      kind = VALID_KINDS.includes(rawKind as KnowledgeKind)
        ? (rawKind as KnowledgeKind)
        : file.name.toLowerCase().endsWith(".md")
          ? "MARKDOWN"
          : "TEXT";
      content = buffer.toString("utf8");
    }
  } else {
    const body = await req.json();
    title = String(body.title ?? "").trim();
    content = String(body.content ?? "").trim();
    const rawKind = String(body.kind ?? "TEXT").toUpperCase();
    kind = VALID_KINDS.includes(rawKind as KnowledgeKind) ? (rawKind as KnowledgeKind) : "TEXT";
    tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  }

  if (!title) return jsonError(400, "Title is required");
  if (!content) return jsonError(400, "Document has no extractable text");

  const document = await ingestDocument({ title, kind, content, tags, sizeBytes });
  return NextResponse.json(
    { document: { id: document.id, title: document.title, chunks: document._count.chunks } },
    { status: 201 },
  );
});
