import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import getTurso from "@/lib/turso";

export async function GET(request: NextRequest) {
  const db = getDb();
  const turso = getTurso();
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("categorySlug");
  const ageGroup = searchParams.get("ageGroup");
  const type = searchParams.get("type");
  const subcategoryId = searchParams.get("subcategoryId");

  let query = `
    SELECT r.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (categorySlug) {
    conditions.push("c.slug = ?");
    params.push(categorySlug);
  }
  if (ageGroup) {
    conditions.push("r.age_group LIKE ?");
    params.push(`%${ageGroup}%`);
  }
  if (type) {
    conditions.push("r.type = ?");
    params.push(type);
  }
  if (subcategoryId) {
    conditions.push("r.subcategory_id = ?");
    params.push(Number(subcategoryId));
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY r.sort_order";

  const resources = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

  // Fetch like counts and comment counts from Turso for all resources
  if (resources.length > 0) {
    const ids = resources.map((r) => r.id as number);
    const placeholders = ids.map(() => "?").join(",");

    const [likeResults, commentResults] = await Promise.all([
      turso.execute({
        sql: `SELECT resource_id, COALESCE(SUM(value), 0) as like_count FROM likes WHERE resource_id IN (${placeholders}) GROUP BY resource_id`,
        args: ids,
      }),
      turso.execute({
        sql: `SELECT resource_id, COUNT(*) as comment_count FROM comments WHERE resource_id IN (${placeholders}) GROUP BY resource_id`,
        args: ids,
      }),
    ]);

    const likeCounts = new Map<number, number>();
    for (const row of likeResults.rows) {
      likeCounts.set(row.resource_id as number, row.like_count as number);
    }

    const commentCounts = new Map<number, number>();
    for (const row of commentResults.rows) {
      commentCounts.set(row.resource_id as number, row.comment_count as number);
    }

    for (const resource of resources) {
      resource.like_count = likeCounts.get(resource.id as number) ?? 0;
      resource.comment_count = commentCounts.get(resource.id as number) ?? 0;
    }
  }

  return NextResponse.json({ resources });
}
