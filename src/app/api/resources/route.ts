import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("categorySlug");
  const ageGroup = searchParams.get("ageGroup");
  const type = searchParams.get("type");
  const subcategoryId = searchParams.get("subcategoryId");

  let query = `
    SELECT r.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name,
           COALESCE(SUM(l.value), 0) as like_count,
           (SELECT COUNT(*) FROM comments WHERE resource_id = r.id) as comment_count
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    LEFT JOIN likes l ON r.id = l.resource_id
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

  query += " GROUP BY r.id ORDER BY r.sort_order";

  const resources = db.prepare(query).all(...params);
  return NextResponse.json({ resources });
}
