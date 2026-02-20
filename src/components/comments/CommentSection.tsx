"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/helpers";

interface Comment {
  id: number;
  nickname: string;
  body: string;
  created_at: string;
}

export default function CommentSection({
  resourceId,
  initialComments,
}: {
  resourceId: number;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (body.length > 500) {
      setError(t.comments.tooLong);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          nickname: nickname.trim() || undefined,
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t.comments.failedToPost);
        return;
      }

      const data = await res.json();
      setComments([data.comment, ...comments]);
      setBody("");
    } catch {
      setError(t.comments.failedToPost);
    } finally {
      setSubmitting(false);
    }
  }

  function timeAgo(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr + "Z");
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t.comments.justNow;
    if (diffMins < 60) return interpolate(t.comments.minutesAgo, { count: diffMins });
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return interpolate(t.comments.hoursAgo, { count: diffHrs });
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return interpolate(t.comments.daysAgo, { count: diffDays });
    return date.toLocaleDateString();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {interpolate(t.comments.title, { count: comments.length })}
      </h3>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6 bg-muted rounded-lg p-4">
        <div className="mb-3">
          <input
            type="text"
            placeholder={t.comments.nicknamePlaceholder}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="mb-3">
          <textarea
            placeholder={t.comments.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
          <div className="flex justify-between mt-1">
            {error && <span className="text-xs text-red-500">{error}</span>}
            <span className="text-xs text-muted-foreground ml-auto">{body.length}/500</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t.comments.posting : t.comments.postComment}
        </button>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t.comments.noComments}
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{comment.nickname}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
