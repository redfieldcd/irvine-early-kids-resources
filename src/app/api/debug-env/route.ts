import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL || "";
  const url = rawUrl.replace(/^libsql:\/\//, "https://");
  const authToken = process.env.TURSO_AUTH_TOKEN || "";

  try {
    // Test if URL parses first
    new URL(url);
    const client = createClient({ url, authToken });
    const result = await client.execute("SELECT 1 as ok");
    return NextResponse.json({
      rawUrl,
      httpUrl: url,
      urlLength: url.length,
      tokenLength: authToken.length,
      connected: true,
      result: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json({
      rawUrl,
      httpUrl: url,
      urlLength: url.length,
      tokenLength: authToken.length,
      connected: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
