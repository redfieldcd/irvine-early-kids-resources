import { NextRequest, NextResponse } from "next/server";
import getTurso from "@/lib/turso";
import { cookies } from "next/headers";

function getSessionId(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  let sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

// GET — return total count and whether this session has supported
export async function GET() {
  try {
    const turso = getTurso();
    const cookieStore = await cookies();
    const sessionId = getSessionId(cookieStore);

    const [countResult, userResult] = await Promise.all([
      turso.execute("SELECT COUNT(*) as count FROM support_hearts"),
      turso.execute({ sql: "SELECT id FROM support_hearts WHERE session_id = ?", args: [sessionId] }),
    ]);

    const count = Number(countResult.rows[0]?.count ?? 0);
    const supported = userResult.rows.length > 0;

    return NextResponse.json({ count, supported });
  } catch (error) {
    console.error("Support GET error:", error);
    return NextResponse.json({ count: 0, supported: false });
  }
}

// POST — toggle support (add or remove heart)
export async function POST(request: NextRequest) {
  try {
    const turso = getTurso();
    const cookieStore = await cookies();
    const sessionId = getSessionId(cookieStore);

    // Check if already supported
    const existing = await turso.execute({
      sql: "SELECT id FROM support_hearts WHERE session_id = ?",
      args: [sessionId],
    });

    let supported: boolean;

    if (existing.rows.length > 0) {
      // Remove support
      await turso.execute({ sql: "DELETE FROM support_hearts WHERE session_id = ?", args: [sessionId] });
      supported = false;
    } else {
      // Add support
      await turso.execute({ sql: "INSERT INTO support_hearts (session_id) VALUES (?)", args: [sessionId] });
      supported = true;
    }

    const countResult = await turso.execute("SELECT COUNT(*) as count FROM support_hearts");
    const count = Number(countResult.rows[0]?.count ?? 0);

    const response = NextResponse.json({ count, supported });
    response.cookies.set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Support POST error:", error);
    return NextResponse.json({ error: "Failed to update support" }, { status: 500 });
  }
}
