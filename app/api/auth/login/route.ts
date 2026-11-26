import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureDbInitialized } from "@/lib/init";
import { authenticateUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const sessionId = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    await writeAudit({
      actor_id: user.id,
      entity_type: "session",
      entity_id: sessionId,
      action: "login",
      old_value: null,
      new_value: null,
    });

    return NextResponse.json({
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role_name },
    });
  } catch (err) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
