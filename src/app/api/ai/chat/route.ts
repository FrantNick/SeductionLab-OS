import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { isFlagEnabled } from "@/lib/feature-flags";
import { AiNotConfiguredError, runAssistantTurn } from "@/lib/ai/service";
import { AiRequestError, type ChatMessage } from "@/lib/ai/adapters";

export const maxDuration = 120;

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(8000),
});

/**
 * POST /api/ai/chat — one assistant turn. The user message is stored,
 * the configured provider is called with live platform context, and the
 * real response is stored. With no provider configured this returns 503
 * and stores nothing — the platform never fabricates AI output.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  if (!(await isFlagEnabled("ai"))) return jsonError(403, "AI features are disabled");

  const { conversationId, message } = chatSchema.parse(await req.json());

  let conversation = conversationId
    ? await prisma.aiConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  if (conversation && conversation.userId !== session.user.id) {
    return jsonError(403, "Not your conversation");
  }

  // Resolve the provider BEFORE persisting anything, so an unconfigured
  // platform doesn't accumulate one-sided conversations.
  const history: ChatMessage[] = (conversation?.messages ?? []).map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));

  let result;
  try {
    result = await runAssistantTurn(history, message);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return jsonError(503, err.message);
    if (err instanceof AiRequestError) return jsonError(502, err.message);
    throw err;
  }

  if (!conversation) {
    const created = await prisma.aiConversation.create({
      data: { userId: session.user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
    conversation = { ...created, messages: [] };
  }

  await prisma.$transaction([
    prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: "user", content: message },
    }),
    prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: result.content,
        meta: { provider: result.provider, model: result.model, usage: result.usage ?? null },
      },
    }),
    prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    conversationId: conversation.id,
    reply: result.content,
    provider: result.provider,
    model: result.model,
  });
});
