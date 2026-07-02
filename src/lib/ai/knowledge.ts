import type { KnowledgeKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Knowledge-base ingestion. Documents are chunked immediately so the
 * retrieval layer (keyword now, embeddings later) has a stable unit to
 * work with — adding a RAG embedding pipeline only means filling
 * KnowledgeChunk.embedding, no re-ingestion.
 */

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // Prefer breaking at a paragraph/sentence boundary near the end.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (breakAt > CHUNK_SIZE * 0.5) end = start + breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

export async function ingestDocument(input: {
  title: string;
  kind: KnowledgeKind;
  content: string;
  tags?: string[];
  sizeBytes?: number;
}) {
  const chunks = chunkText(input.content);

  return prisma.knowledgeDocument.create({
    data: {
      title: input.title,
      kind: input.kind,
      content: input.content,
      tags: input.tags ?? [],
      sizeBytes: input.sizeBytes ?? Buffer.byteLength(input.content, "utf8"),
      status: chunks.length > 0 ? "READY" : "PENDING_EXTRACTION",
      chunks: {
        create: chunks.map((content, index) => ({ index, content })),
      },
    },
    include: { _count: { select: { chunks: true } } },
  });
}
