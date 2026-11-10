import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "sharedcred-private";
const workspaceSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({ fullName: z.string().max(120), email: z.string().email() }).nullable(),
  practitioners: z.array(z.unknown()).max(250),
  notifications: z.array(z.string().max(500)).max(100),
});

async function authenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const path = `users/${user.id}/workspace.json`;
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error) {
    if (error.message.toLowerCase().includes("not found") || error.message.includes("404")) {
      return NextResponse.json({
        authenticated: true,
        user: { fullName: user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "Provider", email: user.email ?? "" },
        practitioners: [],
        notifications: [],
      });
    }
    return NextResponse.json({ error: "Unable to load workspace" }, { status: 502 });
  }
  return new NextResponse(await data.text(), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await request.json();
  const parsed = workspaceSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace payload" }, { status: 400 });
  const safeWorkspace = {
    ...parsed.data,
    authenticated: true,
    user: { fullName: parsed.data.user?.fullName ?? user.user_metadata.full_name ?? "Provider", email: user.email ?? parsed.data.user?.email ?? "" },
  };
  const body = JSON.stringify(safeWorkspace);
  if (body.length > 4_000_000) return NextResponse.json({ error: "Workspace is too large" }, { status: 413 });
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(`users/${user.id}/workspace.json`, body, { contentType: "application/json", upsert: true });
  if (error) return NextResponse.json({ error: "Unable to save workspace" }, { status: 502 });
  return NextResponse.json({ saved: true, savedAt: new Date().toISOString() });
}
