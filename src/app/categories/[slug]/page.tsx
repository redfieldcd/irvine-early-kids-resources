import Link from "next/link";
import { notFound } from "next/navigation";
import getDb from "@/lib/db";
import getTurso from "@/lib/turso";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { interpolate } from "@/i18n/helpers";

interface Resource {
  id: number;
  name: string;
  slug: string;
  type: string;
  age_group: string;
  description: string;
  cost: string;
  location: string | null;
  subcategory_name: string | null;
  subcategory_id: number | null;
  like_count: number;
  comment_count: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  target_age_groups: string;
  key_focus_areas: string;
}

interface Subcategory {
  id: number;
  name: string;
  slug: string;
}

const categoryColors: Record<string, string> = {
  "sibling-relationships": "from-pink-50 to-rose-50",
  "parenting-techniques": "from-blue-50 to-indigo-50",
  "mandarin-study": "from-amber-50 to-yellow-50",
  "aftercare-programs": "from-emerald-50 to-green-50",
  "weekend-activities": "from-orange-50 to-amber-50",
  "preschools": "from-purple-50 to-violet-50",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const db = getDb();
  const { slug } = await params;
  const t = await getDictionary();
  const category = db.prepare("SELECT * FROM categories WHERE slug = ?").get(slug) as Category | undefined;
  if (!category) return { title: t.meta.notFound };
  return {
    title: `${category.name} | ${t.meta.siteTitle}`,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const turso = getTurso();
  const { slug } = await params;
  const t = await getDictionary();
  const category = db.prepare("SELECT * FROM categories WHERE slug = ?").get(slug) as Category | undefined;

  if (!category) notFound();

  const subcategories = db.prepare(
    "SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order"
  ).all(category.id) as Subcategory[];

  // Get resources from local SQLite (static content only)
  const resources = db.prepare(`
    SELECT r.*, s.name as subcategory_name
    FROM resources r
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.category_id = ?
    ORDER BY r.sort_order
  `).all(category.id) as Resource[];

  // Fetch like counts and comment counts from Turso
  if (resources.length > 0) {
    const ids = resources.map((r) => r.id);
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
      resource.like_count = likeCounts.get(resource.id) ?? 0;
      resource.comment_count = commentCounts.get(resource.id) ?? 0;
    }
  }

  const gradient = categoryColors[slug] || "from-gray-50 to-white";

  // Group resources by subcategory
  const grouped: Record<string, Resource[]> = {};
  for (const r of resources) {
    const key = r.subcategory_name || t.category.other;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div>
      {/* Header */}
      <section className={`bg-gradient-to-br ${gradient} py-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">{t.category.breadcrumbHome}</Link>
            <span>/</span>
            <span className="text-foreground">{category.name}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{category.name}</h1>
          <p className="text-muted-foreground max-w-2xl">{category.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs bg-white/80 text-muted-foreground px-3 py-1 rounded-full">
              {interpolate(t.category.resourceCount, { count: resources.length })}
            </span>
            <span className="text-xs bg-white/80 text-muted-foreground px-3 py-1 rounded-full">
              {interpolate(t.category.ages, { ages: category.target_age_groups })}
            </span>
          </div>
        </div>
      </section>

      {/* Subcategory Quick Nav */}
      {subcategories.length > 1 && (
        <div className="bg-white border-b border-border sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 py-3 overflow-x-auto no-scrollbar">
              {subcategories.map((sub) => (
                <a
                  key={sub.id}
                  href={`#${sub.slug}`}
                  className="whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-colors"
                >
                  {sub.name.replace(/[()]/g, "").toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resource List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {Object.entries(grouped).map(([subcatName, subcatResources]) => {
          const sub = subcategories.find(s => s.name === subcatName);
          return (
            <div key={subcatName} id={sub?.slug} className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-4 capitalize">
                {subcatName.toLowerCase().replace(/^\w/, c => c.toUpperCase())}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subcatResources.map((resource) => (
                  <Link
                    key={resource.id}
                    href={`/resources/${resource.id}`}
                    className="group block bg-card rounded-lg border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {resource.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">{resource.type}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">{resource.age_group}</span>
                      {resource.cost && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          resource.cost.toLowerCase().includes("free") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {resource.cost}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{resource.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {resource.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {resource.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        👍 {resource.like_count}
                      </span>
                      <span className="flex items-center gap-1">
                        💬 {resource.comment_count}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
