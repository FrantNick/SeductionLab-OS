"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

/** Admin control: manually trigger a background job via /api/admin/jobs. */
export function RunJobButton({
  job,
  label,
  variant = "secondary",
}: {
  job: "leaderboard" | "refresh-metrics" | "all";
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      await api.post("/api/admin/jobs", { job });
      toast({ kind: "success", title: `${label} completed` });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: `${label} failed`, description: errorMessage(err) });
    } finally {
      setRunning(false);
    }
  }

  const className =
    variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-secondary";

  return (
    <button type="button" className={className} onClick={run} disabled={running}>
      {running ? "Running…" : label}
    </button>
  );
}
