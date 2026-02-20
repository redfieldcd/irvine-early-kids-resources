import getDb from "./db";

export function trackEvent(
  eventType: string,
  sessionId: string,
  page: string,
  resourceId?: number,
  metadata?: string
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO analytics_events (event_type, session_id, page, resource_id, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(eventType, sessionId, page, resourceId ?? null, metadata ?? null);
}
