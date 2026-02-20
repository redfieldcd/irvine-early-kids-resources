import getTurso from "./turso";

export async function trackEvent(
  eventType: string,
  sessionId: string,
  page: string,
  resourceId?: number,
  metadata?: string
) {
  const turso = getTurso();
  await turso.execute({
    sql: `INSERT INTO analytics_events (event_type, session_id, page, resource_id, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    args: [eventType, sessionId, page, resourceId ?? null, metadata ?? null],
  });
}
