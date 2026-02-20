import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const db = getDb();
  const sessionId = await getOrCreateSessionId();
  const { resourceId, value } = await request.json();

  if (!resourceId || (value !== 1 && value !== -1)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = db.prepare(
    "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?"
  ).get(resourceId, sessionId) as { value: number } | undefined;

  if (existing) {
    if (existing.value === value) {
      // Same vote: remove it (toggle off)
      db.prepare(
        "DELETE FROM likes WHERE resource_id = ? AND session_id = ?"
      ).run(resourceId, sessionId);
    } else {
      // Different vote: update
      db.prepare(
        "UPDATE likes SET value = ? WHERE resource_id = ? AND session_id = ?"
      ).run(value, resourceId, sessionId);
    }
  } else {
    // New vote
    db.prepare(
      "INSERT INTO likes (resource_id, session_id, value) VALUES (?, ?, ?)"
    ).run(resourceId, sessionId, value);
  }

  const result = db.prepare(
    "SELECT COALESCE(SUM(value), 0) as like_count FROM likes WHERE resource_id = ?"
  ).get(resourceId) as { like_count: number };

  const userVote = db.prepare(
    "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?"
  ).get(resourceId, sessionId) as { value: number } | undefined;

  return NextResponse.json({
    likeCount: result.like_count,
    userVote: userVote?.value ?? null,
  });
}
