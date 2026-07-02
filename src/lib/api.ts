import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler with uniform auth/validation/error responses. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) return jsonError(err.status, err.message);
      if (err instanceof ZodError) {
        return jsonError(400, err.errors.map((e) => e.message).join("; "));
      }
      console.error("[api]", err);
      return jsonError(500, "Internal server error");
    }
  };
}
