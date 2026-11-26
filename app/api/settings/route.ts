import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/settings - public site settings (no secrets) */
export async function GET(): Promise<Response> {
  try {
    await ensureDbInitialized();
    const db = await getDb();
    const rows = queryAll(db, "SELECT key, value FROM site_settings", [])
    const settings: Record<string, string> = {};
    for (const r of rows) settings[String(r.key)] = String(r.value);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: String(err), stack: err instanceof Error ? err.stack : null }, { status: 500 });
  }
}

/** PUT /api/settings - update settings (settings.manage) */
export async function PUT(req: Request): Promise<Response> {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { settings } = body;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "settings object required" }, { status: 400 });
    }
    const db = await getDb();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      run(db,
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [key, value, now]);
    }
    await writeAudit({ actor_id: auth.user!.id, entity_type: "settings", entity_id: "site_settings", action: "update", old_value: null, new_value: JSON.stringify(Object.keys(settings)) });
    persistDb(db);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
