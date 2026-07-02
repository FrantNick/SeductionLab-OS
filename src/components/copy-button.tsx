"use client";

import { useClipboard } from "@/hooks/use-clipboard";
import { useToast } from "@/components/toast";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copied, copy } = useClipboard();
  const { toast } = useToast();

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await copy(text);
        toast({ kind: "success", title: "Copied to clipboard" });
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
