import { getDb, queryAll, queryOne } from "./db";

export interface Permission {
  id: string;
  permission_key: string;
  description: string;
}

let permissionCache: Map<string, string[]> | null = null;

/** All permission keys defined by the PRD (§15.1). */
export const PERMISSION_KEYS = [
  "products.create",
  "products.edit",
  "products.delete",
  "products.publish",
  "products.archive",
  "pricing.view_purchase_cost",
  "pricing.edit",
  "inventory.edit",
  "categories.manage",
  "collections.manage",
  "inquiries.view",
  "analytics.view",
  "staff.manage",
  "settings.manage",
  "backups.restore",
  "audit_logs.view",
] as const;

/** Permission keys granted to each suggested role (PRD §15). */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  "Owner / Super Admin": [...PERMISSION_KEYS],
  Manager: [
    "products.create",
    "products.edit",
    "products.delete",
    "products.publish",
    "products.archive",
    "pricing.edit",
    "inventory.edit",
    "categories.manage",
    "collections.manage",
    "inquiries.view",
    "analytics.view",
  ],
  "Product Staff": [
    "products.create",
    "products.edit",
    "inventory.edit",
  ],
  "Content Staff": [
    "categories.manage",
    "collections.manage",
  ],
  Viewer: ["analytics.view"],
};

/**
 * Get the set of permission keys for a role. Results are cached for the
 * lifetime of the server process (roles change infrequently).
 */
export async function getRolePermissions(
  roleId: string
): Promise<string[]> {
  if (permissionCache && permissionCache.has(roleId)) {
    return permissionCache.get(roleId)!;
  }
  const db = await getDb();
  const rows = queryAll(db,
    `SELECT p.permission_key
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]);
  const keys = rows.map((r) => r.permission_key as string);
  if (!permissionCache) permissionCache = new Map();
  permissionCache.set(roleId, keys);
  return keys;
}

/** Clear the permission cache (call after role/permission changes). */
export function clearPermissionCache(): void {
  permissionCache = null;
}

/** Check whether a user (by role id) has a given permission. */
export async function hasPermission(
  roleId: string,
  permissionKey: string
): Promise<boolean> {
  const keys = await getRolePermissions(roleId);
  return keys.includes(permissionKey);
}

/** Check whether a user has ALL of the given permissions. */
export async function hasAllPermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const keys = await getRolePermissions(roleId);
  return permissionKeys.every((k) => keys.includes(k));
}

/** Check whether a user has ANY of the given permissions. */
export async function hasAnyPermission(
  roleId: string,
  permissionKeys: string[]
): Promise<boolean> {
  const keys = await getRolePermissions(roleId);
  return permissionKeys.some((k) => keys.includes(k));
}

/** List all permissions with their keys and descriptions. */
export async function listPermissions(): Promise<Permission[]> {
  const db = await getDb();
  return queryAll(db, "SELECT id, permission_key, description FROM permissions", [])
    .map((r) => ({ id: String(r.id), permission_key: String(r.permission_key), description: String(r.description ?? "") }));
}
