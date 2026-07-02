"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Message = { role: "user" | "assistant"; content: string };

type ChatResponse = {
  conversationId: string;
  reply: string;
  provider: string;
  model: string;
};

/**
 * AI chat over live platform context. The backend refuses to answer
 * without a configured provider (503) — this component surfaces that
 * state honestly instead of simulating a reply.
 */
export function AiChat({
  configured,
  providerLabel,
}: {
  configured: boolean;
  providerLabel: string | null;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await api.post<ChatResponse>("/api/ai/chat", {
        conversationId: conversationId.current,
        message,
      });
      conversationId.current = res.conversationId;
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      // roll the failed user message back so retry doesn't duplicate it
      setMessages((prev) => prev.slice(0, -1));
      setInput(message);
      if (err instanceof ApiError && err.status === 503) {
        setNotConfigured(err.message);
      } else {
        toast({ kind: "error", title: "Chat failed", description: errorMessage(err) });
      }
    } finally {
      setSending(false);
    }
  }

  if (!configured || notConfigured) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <p className="text-sm font-medium text-zinc-300">AI chat is not configured</p>
        <p className="mt-1.5 max-w-md text-xs text-zinc-500">
          {notConfigured ??
            "The chat assistant needs an enabled provider, model and feature config. Nothing is simulated — connect a real provider to start."}
        </p>
        <Link href="/admin/ai" className="btn-primary mt-4">
          Configure AI
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[36rem] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-zinc-400">
              Ask about campaigns, threads, metrics or leaderboards.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Answers use live platform data and the knowledge base · {providerLabel}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-ember text-white"
                  : "border border-ink-700 bg-ink-900 text-zinc-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-zinc-500">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-ink-700 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input flex-1"
          placeholder="Ask the assistant…"
          maxLength={8000}
          aria-label="Chat message"
          disabled={sending}
        />
        <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
