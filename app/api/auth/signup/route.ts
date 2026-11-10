import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, email, and password of at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    });

    if (error) {
      const duplicate = /already|registered|exists/i.test(error.message);
      return NextResponse.json(
        { error: duplicate ? "An account already exists for this email." : error.message },
        { status: duplicate ? 409 : 400 },
      );
    }

    return NextResponse.json({ created: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable." },
      { status: 503 },
    );
  }
}
