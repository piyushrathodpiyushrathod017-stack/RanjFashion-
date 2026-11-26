import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { getSessionUser } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  await ensureDbInitialized();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
