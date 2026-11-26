import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/auth";

export interface SessionUser {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
}

/** Read the current session user from the HttpOnly cookie. Returns null if no valid session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session")?.value;
    if (!sessionId) return null;

    const session = await getSession(sessionId);
    if (!session) return null;

    return await getUserById(session.userId);
  } catch {
    return null;
  }
}
