"use client";

import { useActionState, useEffect } from "react";
import { changePassword } from "@/app/dashboard/settings/actions";
import { useToast } from "@/components/toast";

export function PasswordForm() {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(changePassword, null);

  useEffect(() => {
    if (state?.ok) toast({ kind: "success", title: "Password updated" });
    if (state?.error) toast({ kind: "error", title: "Password not changed", description: state.error });
  }, [state, toast]);

  return (
    <form action={action} className="grid max-w-md gap-4">
      <div>
        <label htmlFor="pw-current" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Current password
        </label>
        <input
          id="pw-current"
          name="currentPassword"
          type="password"
          className="input"
          required
          autoComplete="current-password"
        />
      </div>
      <div>
        <label htmlFor="pw-new" className="mb-1.5 block text-xs font-medium text-zinc-400">
          New password
        </label>
        <input
          id="pw-new"
          name="newPassword"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      <button type="submit" className="btn-primary w-fit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
