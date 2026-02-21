import { NextRequest, NextResponse } from "next/server";
import getTurso from "@/lib/turso";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const sanitizedEmail = email.trim().toLowerCase().slice(0, 255);

    const turso = getTurso();

    // Check if already subscribed
    const existing = await turso.execute({
      sql: "SELECT id FROM subscribers WHERE email = ?",
      args: [sanitizedEmail],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    await turso.execute({
      sql: "INSERT INTO subscribers (email) VALUES (?)",
      args: [sanitizedEmail],
    });

    // Get total subscriber count
    const countResult = await turso.execute("SELECT COUNT(*) as count FROM subscribers");
    const count = Number(countResult.rows[0]?.count ?? 0);

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
