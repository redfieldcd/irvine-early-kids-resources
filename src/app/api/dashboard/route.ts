import { NextRequest, NextResponse } from "next/server";
import getTurso from "@/lib/turso";
import getDb from "@/lib/db";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin123";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  // Simple password check via query param or header
  const password =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-dashboard-key");
  if (password !== DASHBOARD_PASSWORD) {
    return unauthorized();
  }

  try {
    const turso = getTurso();
    const db = getDb();

    // Run all queries in parallel
    const [
      // Page views
      totalPageViews,
      pageViewsByPage,
      pageViewsByDay,
      uniqueVisitors,
      // Outbound clicks
      totalClicks,
      clicksByResource,
      // Likes
      totalLikes,
      topLikedResources,
      // Comments
      totalComments,
      recentComments,
      // Support hearts
      totalHearts,
      // Recent activity (last 7 days)
      recentPageViews,
      recentClicks,
    ] = await Promise.all([
      // Total page views
      turso.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view'"),
      // Page views by page (top 20)
      turso.execute("SELECT page, COUNT(*) as views FROM analytics_events WHERE event_type = 'page_view' GROUP BY page ORDER BY views DESC LIMIT 20"),
      // Page views by day (last 30 days)
      turso.execute("SELECT DATE(created_at) as date, COUNT(*) as views FROM analytics_events WHERE event_type = 'page_view' AND created_at >= datetime('now', '-30 days') GROUP BY DATE(created_at) ORDER BY date"),
      // Unique visitors (unique session_ids)
      turso.execute("SELECT COUNT(DISTINCT session_id) as count FROM analytics_events"),
      // Total outbound clicks
      turso.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'outbound_click'"),
      // Clicks by resource (top 20)
      turso.execute("SELECT resource_id, COUNT(*) as clicks FROM analytics_events WHERE event_type = 'outbound_click' AND resource_id IS NOT NULL GROUP BY resource_id ORDER BY clicks DESC LIMIT 20"),
      // Total likes (positive votes)
      turso.execute("SELECT COUNT(*) as count FROM likes WHERE value = 1"),
      // Top liked resources
      turso.execute("SELECT resource_id, SUM(value) as score, COUNT(*) as votes FROM likes GROUP BY resource_id ORDER BY score DESC LIMIT 20"),
      // Total comments
      turso.execute("SELECT COUNT(*) as count FROM comments"),
      // Recent comments (last 20)
      turso.execute("SELECT id, resource_id, nickname, body, created_at FROM comments ORDER BY created_at DESC LIMIT 20"),
      // Support hearts
      turso.execute("SELECT COUNT(*) as count FROM support_hearts"),
      // Recent page views (last 7 days)
      turso.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= datetime('now', '-7 days')"),
      // Recent clicks (last 7 days)
      turso.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'outbound_click' AND created_at >= datetime('now', '-7 days')"),
    ]);

    // Get resource names from SQLite for enrichment
    const resourceIds = new Set<number>();
    for (const row of clicksByResource.rows) {
      if (row.resource_id) resourceIds.add(Number(row.resource_id));
    }
    for (const row of topLikedResources.rows) {
      if (row.resource_id) resourceIds.add(Number(row.resource_id));
    }
    for (const row of recentComments.rows) {
      if (row.resource_id) resourceIds.add(Number(row.resource_id));
    }

    const resourceNames: Record<number, string> = {};
    if (resourceIds.size > 0) {
      const ids = Array.from(resourceIds);
      const placeholders = ids.map(() => "?").join(",");
      const resources = db
        .prepare(`SELECT id, name FROM resources WHERE id IN (${placeholders})`)
        .all(...ids) as { id: number; name: string }[];
      for (const r of resources) {
        resourceNames[r.id] = r.name;
      }
    }

    // Category stats from SQLite
    const categories = db
      .prepare(
        "SELECT c.name, c.slug, (SELECT COUNT(*) FROM resources WHERE category_id = c.id) as resource_count FROM categories c ORDER BY sort_order"
      )
      .all() as { name: string; slug: string; resource_count: number }[];

    const totalResources = (
      db.prepare("SELECT COUNT(*) as cnt FROM resources").get() as {
        cnt: number;
      }
    ).cnt;

    return NextResponse.json({
      overview: {
        totalPageViews: Number(totalPageViews.rows[0]?.count ?? 0),
        totalClicks: Number(totalClicks.rows[0]?.count ?? 0),
        uniqueVisitors: Number(uniqueVisitors.rows[0]?.count ?? 0),
        totalLikes: Number(totalLikes.rows[0]?.count ?? 0),
        totalComments: Number(totalComments.rows[0]?.count ?? 0),
        totalHearts: Number(totalHearts.rows[0]?.count ?? 0),
        totalResources,
        totalCategories: categories.length,
        last7Days: {
          pageViews: Number(recentPageViews.rows[0]?.count ?? 0),
          clicks: Number(recentClicks.rows[0]?.count ?? 0),
        },
      },
      pageViewsByPage: pageViewsByPage.rows.map((r) => ({
        page: r.page,
        views: Number(r.views),
      })),
      pageViewsByDay: pageViewsByDay.rows.map((r) => ({
        date: r.date,
        views: Number(r.views),
      })),
      topClickedResources: clicksByResource.rows.map((r) => ({
        resourceId: Number(r.resource_id),
        resourceName: resourceNames[Number(r.resource_id)] || `Resource #${r.resource_id}`,
        clicks: Number(r.clicks),
      })),
      topLikedResources: topLikedResources.rows.map((r) => ({
        resourceId: Number(r.resource_id),
        resourceName: resourceNames[Number(r.resource_id)] || `Resource #${r.resource_id}`,
        score: Number(r.score),
        votes: Number(r.votes),
      })),
      recentComments: recentComments.rows.map((r) => ({
        id: Number(r.id),
        resourceId: Number(r.resource_id),
        resourceName: resourceNames[Number(r.resource_id)] || `Resource #${r.resource_id}`,
        nickname: r.nickname,
        body: r.body,
        createdAt: r.created_at,
      })),
      categories,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
