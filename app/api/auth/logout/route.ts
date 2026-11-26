import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureDbInitialized } from "@/lib/init";
import { deleteSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  await ensureDbInitialized();
  try {
    const user = await getSessionUser();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session")?.value;

    if (sessionId) {
      await deleteSession(sessionId);
      if (user) {
        await writeAudit({
          actor_id: user.id,
          entity_type: "session",
          entity_id: sessionId,
          action: "logout",
          old_value: null,
          new_value: null,
        });
      }
    }

    cookieStore.delete("session");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
