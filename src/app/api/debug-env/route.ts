import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export async function GET() {
  const url = (process.env.TURSO_DATABASE_URL || "").replace(/^libsql:\/\//, "https://");
  const authToken = process.env.TURSO_AUTH_TOKEN || "";

  try {
    const client = createClient({ url, authToken });
    const result = await client.execute("SELECT 1 as ok");
    return NextResponse.json({
      tursoUrl: url.substring(0, 40),
      connected: true,
      result: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json({
      tursoUrl: url.substring(0, 40),
      connected: false,
      error: String(error),
    });
  }
}
