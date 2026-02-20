import { NextRequest, NextResponse } from "next/server";
import getTurso from "@/lib/turso";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const turso = getTurso();
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId");

  if (!resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }

  const result = await turso.execute({
    sql: "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC",
    args: [Number(resourceId)],
  });

  return NextResponse.json({ comments: result.rows });
}

export async function POST(request: NextRequest) {
  const turso = getTurso();
  const sessionId = await getOrCreateSessionId();
  const { resourceId, nickname, body } = await request.json();

  if (!resourceId || !body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "resourceId and body required" }, { status: 400 });
  }

  if (body.length > 500) {
    return NextResponse.json({ error: "Comment too long (max 500 chars)" }, { status: 400 });
  }

  const sanitizedNickname = (nickname && typeof nickname === "string" && nickname.trim())
    ? nickname.trim().substring(0, 50)
    : "Anonymous Parent";

  const result = await turso.execute({
    sql: "INSERT INTO comments (resource_id, session_id, nickname, body) VALUES (?, ?, ?, ?)",
    args: [resourceId, sessionId, sanitizedNickname, body.trim()],
  });

  const comment = await turso.execute({
    sql: "SELECT * FROM comments WHERE id = ?",
    args: [Number(result.lastInsertRowid)],
  });

  return NextResponse.json({ comment: comment.rows[0] }, { status: 201 });
}
