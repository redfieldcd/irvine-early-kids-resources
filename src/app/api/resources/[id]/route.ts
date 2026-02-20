import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id } = await params;
  const resourceId = Number(id);
  const sessionId = await getOrCreateSessionId();

  const resource = db.prepare(`
    SELECT r.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name,
           COALESCE((SELECT SUM(value) FROM likes WHERE resource_id = r.id), 0) as like_count,
           (SELECT COUNT(*) FROM comments WHERE resource_id = r.id) as comment_count
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.id = ?
  `).get(resourceId);

  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userVote = db.prepare(
    "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?"
  ).get(resourceId, sessionId) as { value: number } | undefined;

  const comments = db.prepare(
    "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC"
  ).all(resourceId);

  return NextResponse.json({
    resource,
    userVote: userVote?.value ?? null,
    comments,
  });
}
