import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { getDb, queryAll, queryOne } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/analytics - basic first-party metrics (analytics.view) */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorize("analytics.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();

  const totalVisitorsRow = queryOne(
    db,
    "SELECT COUNT(DISTINCT anonymous_session_identifier) AS c FROM product_views",
    []
  ) as { c: number } | null;
  const totalViewsRow = queryOne(db, "SELECT COUNT(*) AS c FROM product_views", []) as { c: number } | null;
  const totalInquiriesRow = queryOne(db, "SELECT COUNT(*) AS c FROM inquiries", []) as { c: number } | null;
  const totalProductsRow = queryOne(
    db,
    "SELECT COUNT(*) AS c FROM products WHERE status = 'active'",
    []
  ) as { c: number } | null;

  const mostViewed = queryAll(
    db,
    `SELECT p.id, p.name_en, p.slug, COUNT(*) AS views FROM product_views v JOIN products p ON p.id = v.product_id GROUP BY p.id ORDER BY views DESC LIMIT 10`,
    []
  );
  const mostInquired = queryAll(
    db,
    `SELECT product_id, product_name_snapshot, COUNT(*) AS inquiries FROM inquiries GROUP BY product_id ORDER BY inquiries DESC LIMIT 10`,
    []
  );

  // Daily views for last 30 days
  const daily = queryAll(
    db,
    `SELECT date(created_at) AS day, COUNT(*) AS views FROM product_views WHERE created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY day ASC`,
    []
  );

  return NextResponse.json({
    total_visitors: totalVisitorsRow?.c ?? 0,
    total_product_views: totalViewsRow?.c ?? 0,
    total_inquiries: totalInquiriesRow?.c ?? 0,
    total_active_products: totalProductsRow?.c ?? 0,
    most_viewed: mostViewed,
    most_inquired: mostInquired,
    daily_views: daily,
  });
}
