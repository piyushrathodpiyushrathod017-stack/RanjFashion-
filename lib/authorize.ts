import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";

/**
 * Authorize a request for a given permission.
 * Returns { user } on success, or sets `response` with a 401/403 on failure.
 */
export async function authorize(permissionKey: string): Promise<{
  user?: { id: string; role_id: string; full_name: string; email: string; role_name: string };
  response?: Response;
}> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const ok = await hasPermission(user.role_id, permissionKey);
  if (!ok) {
    return { response: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }) };
  }
  return { user: { id: user.id, role_id: user.role_id, full_name: user.full_name, email: user.email, role_name: user.role_name } };
}
