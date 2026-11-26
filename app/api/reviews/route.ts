import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

function reviewRow(r: any) {
  return {
    id: r.id,
    product_id: r.product_id,
    rating: r.rating,
    review_text: r.review_text,
    reviewer_display_name: r.reviewer_display_name,
    moderation_status: r.moderation_status,
    created_at: r.created_at,
    moderated_by: r.moderated_by,
    moderated_at: r.moderated_at,
  };
}

/** GET /api/reviews - list reviews (public sees approved; staff sees all) */
export async function GET(req: Request): Promise<Response> {
  await ensureDbInitialized();
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product");
  const status = searchParams.get("status");

  const user = await (await import("@/lib/auth-session")).getSessionUser();
  const isStaff = Boolean(user);

  let where = "1=1";
  const params: unknown[] = [];
  const add = (sql: string, val: unknown) => { where += ` AND ${sql}`; params.push(val); };
  if (product) add("product_id = ?", product);
  if (!isStaff) {
    add("moderation_status = ?", "approved");
  } else if (status) {
    add("moderation_status = ?", status);
  }

  const rows = queryAll(db,
    `SELECT * FROM reviews WHERE ${where} ORDER BY created_at DESC`,
    params);
  return NextResponse.json({ reviews: rows.map(reviewRow) });
}

/** POST /api/reviews - submit a review (public, rate-limit friendly) */
export async function POST(req: Request): Promise<Response> {
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { product_id, rating, review_text, reviewer_display_name } = body;
    if (!product_id || !rating) {
      return NextResponse.json({ error: "product_id and rating are required" }, { status: 400 });
    }
    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    }

    const db = await getDb();
    const rid = id();
    const now = new Date().toISOString();
    // New reviews start as pending for moderation (PRD §10)
    run(db,
      `INSERT INTO reviews (id, product_id, rating, review_text, reviewer_display_name, moderation_status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [rid, product_id, ratingNum, review_text ?? null, reviewer_display_name ?? null, now]);
    persistDb(db);

    return NextResponse.json({ review: reviewRow({ id: rid, product_id, rating: ratingNum, review_text, reviewer_display_name, moderation_status: "pending", created_at: now, moderated_by: null, moderated_at: null }) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
