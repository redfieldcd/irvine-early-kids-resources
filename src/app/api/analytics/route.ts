import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  const sessionId = await getOrCreateSessionId();

  let data;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("text/plain")) {
    const text = await request.text();
    data = JSON.parse(text);
  } else {
    data = await request.json();
  }

  const { eventType, resourceId, page, metadata } = data;

  if (!eventType || !page) {
    return NextResponse.json({ error: "eventType and page required" }, { status: 400 });
  }

  await trackEvent(
    eventType,
    sessionId,
    page,
    resourceId ? Number(resourceId) : undefined,
    metadata ? JSON.stringify(metadata) : undefined
  );

  return NextResponse.json({ ok: true });
}
