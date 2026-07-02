import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, withErrorHandling } from "@/lib/api";

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
});

/**
 * Public sign-up. Every self-registered user is an AFFILIATE;
 * admins are created via seed or promoted from /admin/affiliates.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { email, password, displayName } = registerSchema.parse(await req.json());
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return jsonError(409, "An account with this email already exists");

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashed,
      role: "AFFILIATE",
      affiliate: { create: { displayName, status: "ACTIVE" } },
    },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ user }, { status: 201 });
});
