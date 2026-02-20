import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import getTurso from "@/lib/turso";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const turso = getTurso();
  const { id } = await params;
  const resourceId = Number(id);
  const sessionId = await getOrCreateSessionId();

  // Static resource data from local SQLite
  const resource = db.prepare(`
    SELECT r.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.id = ?
  `).get(resourceId) as Record<string, unknown> | undefined;

  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // User-generated data from Turso (persistent)
  const [likeResult, userVoteResult, commentsResult] = await Promise.all([
    turso.execute({
      sql: "SELECT COALESCE(SUM(value), 0) as like_count FROM likes WHERE resource_id = ?",
      args: [resourceId],
    }),
    turso.execute({
      sql: "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?",
      args: [resourceId, sessionId],
    }),
    turso.execute({
      sql: "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC",
      args: [resourceId],
    }),
  ]);

  resource.like_count = (likeResult.rows[0]?.like_count as number) ?? 0;
  resource.comment_count = commentsResult.rows.length;

  return NextResponse.json({
    resource,
    userVote: userVoteResult.rows.length > 0 ? (userVoteResult.rows[0].value as number) : null,
    comments: commentsResult.rows,
  });
}
