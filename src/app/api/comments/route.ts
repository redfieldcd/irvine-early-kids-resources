import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId");

  if (!resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }

  const comments = db.prepare(
    "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC"
  ).all(Number(resourceId));

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  const db = getDb();
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

  const result = db.prepare(
    "INSERT INTO comments (resource_id, session_id, nickname, body) VALUES (?, ?, ?, ?)"
  ).run(resourceId, sessionId, sanitizedNickname, body.trim());

  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(result.lastInsertRowid);

  return NextResponse.json({ comment }, { status: 201 });
}
