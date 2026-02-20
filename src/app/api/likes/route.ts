import { NextRequest, NextResponse } from "next/server";
import getTurso from "@/lib/turso";
import { getOrCreateSessionId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const turso = getTurso();
  const sessionId = await getOrCreateSessionId();
  const { resourceId, value } = await request.json();

  if (!resourceId || (value !== 1 && value !== -1)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await turso.execute({
    sql: "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?",
    args: [resourceId, sessionId],
  });

  if (existing.rows.length > 0) {
    const existingValue = existing.rows[0].value as number;
    if (existingValue === value) {
      // Same vote: remove it (toggle off)
      await turso.execute({
        sql: "DELETE FROM likes WHERE resource_id = ? AND session_id = ?",
        args: [resourceId, sessionId],
      });
    } else {
      // Different vote: update
      await turso.execute({
        sql: "UPDATE likes SET value = ? WHERE resource_id = ? AND session_id = ?",
        args: [value, resourceId, sessionId],
      });
    }
  } else {
    // New vote
    await turso.execute({
      sql: "INSERT INTO likes (resource_id, session_id, value) VALUES (?, ?, ?)",
      args: [resourceId, sessionId, value],
    });
  }

  const result = await turso.execute({
    sql: "SELECT COALESCE(SUM(value), 0) as like_count FROM likes WHERE resource_id = ?",
    args: [resourceId],
  });

  const userVote = await turso.execute({
    sql: "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?",
    args: [resourceId, sessionId],
  });

  return NextResponse.json({
    likeCount: result.rows[0].like_count as number,
    userVote: userVote.rows.length > 0 ? (userVote.rows[0].value as number) : null,
  });
}
