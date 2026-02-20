import Link from "next/link";
import { notFound } from "next/navigation";
import getDb from "@/lib/db";
import getTurso from "@/lib/turso";
import { getSessionId } from "@/lib/session";
import { getDictionary } from "@/i18n/server";
import LikeButton from "@/components/resources/LikeButton";
import OutboundLink from "@/components/resources/OutboundLink";
import CommentSection from "@/components/comments/CommentSection";
import type { Metadata } from "next";

interface Resource {
  id: number;
  name: string;
  slug: string;
  type: string;
  age_group: string;
  description: string;
  key_topics: string;
  schedule: string | null;
  cost: string;
  website: string | null;
  location: string | null;
  category_id: number;
  category_name: string;
  category_slug: string;
  subcategory_name: string | null;
}

interface Comment {
  id: number;
  nickname: string;
  body: string;
  created_at: string;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const db = getDb();
  const { id } = await params;
  const t = await getDictionary();
  const resource = db.prepare(`
    SELECT r.name, r.description FROM resources r WHERE r.id = ?
  `).get(Number(id)) as { name: string; description: string } | undefined;
  if (!resource) return { title: t.meta.notFound };
  return {
    title: `${resource.name} | ${t.meta.siteTitle}`,
    description: resource.description.substring(0, 160),
  };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const turso = getTurso();
  const { id } = await params;
  const resourceId = Number(id);
  const sessionId = await getSessionId();
  const t = await getDictionary();

  // Read static resource data from local SQLite
  const resource = db.prepare(`
    SELECT r.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name
    FROM resources r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.id = ?
  `).get(resourceId) as Resource | undefined;

  if (!resource) notFound();

  // Read user-generated data from Turso (persistent)
  const [likeResult, userVoteResult, commentsResult] = await Promise.all([
    turso.execute({
      sql: "SELECT COALESCE(SUM(value), 0) as like_count FROM likes WHERE resource_id = ?",
      args: [resourceId],
    }),
    sessionId
      ? turso.execute({
          sql: "SELECT value FROM likes WHERE resource_id = ? AND session_id = ?",
          args: [resourceId, sessionId],
        })
      : Promise.resolve({ rows: [] }),
    turso.execute({
      sql: "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC",
      args: [resourceId],
    }),
  ]);

  const likeCount = (likeResult.rows[0]?.like_count as number) ?? 0;
  const userVote = userVoteResult.rows.length > 0
    ? (userVoteResult.rows[0].value as number)
    : null;
  const comments = commentsResult.rows as unknown as Comment[];

  const topics = resource.key_topics
    ? resource.key_topics.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary transition-colors">{t.resource.breadcrumbHome}</Link>
        <span>/</span>
        <Link href={`/categories/${resource.category_slug}`} className="hover:text-primary transition-colors">
          {resource.category_name}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{resource.name}</span>
      </div>

      {/* Resource Header */}
      <div className="bg-card rounded-xl border border-border p-6 sm:p-8 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">{resource.type}</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">{resource.age_group}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            resource.cost.toLowerCase().includes("free") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}>
            {resource.cost}
          </span>
          {resource.subcategory_name && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium capitalize">
              {resource.subcategory_name.toLowerCase()}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">{resource.name}</h1>
        <p className="text-muted-foreground leading-relaxed mb-6">{resource.description}</p>

        {/* Topics */}
        {topics.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-2">{t.resource.keyTopics}</h3>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span key={topic} className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {resource.schedule && (
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="text-xs text-muted-foreground block">{t.resource.schedule}</span>
                <span className="text-sm text-foreground">{resource.schedule}</span>
              </div>
            </div>
          )}
          {resource.location && (
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <span className="text-xs text-muted-foreground block">{t.resource.location}</span>
                <span className="text-sm text-foreground">{resource.location}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border">
          <LikeButton
            resourceId={resource.id}
            initialLikeCount={likeCount}
            initialUserVote={userVote}
          />
          {resource.website && (
            <OutboundLink href={resource.website} resourceId={resource.id}>
              {t.resource.visitWebsite}
            </OutboundLink>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
        <CommentSection resourceId={resource.id} initialComments={comments} />
      </div>
    </div>
  );
}
