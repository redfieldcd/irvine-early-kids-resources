"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/helpers";

interface LikeButtonProps {
  resourceId: number;
  initialLikeCount: number;
  initialUserVote: number | null;
}

export default function LikeButton({ resourceId, initialLikeCount, initialUserVote }: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [userVote, setUserVote] = useState<number | null>(initialUserVote);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  async function handleVote(value: 1 | -1) {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const prevCount = likeCount;
    const prevVote = userVote;

    if (userVote === value) {
      setLikeCount(likeCount - value);
      setUserVote(null);
    } else if (userVote) {
      setLikeCount(likeCount - userVote + value);
      setUserVote(value);
    } else {
      setLikeCount(likeCount + value);
      setUserVote(value);
    }

    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, value }),
      });
      const data = await res.json();
      setLikeCount(data.likeCount);
      setUserVote(data.userVote);
    } catch {
      setLikeCount(prevCount);
      setUserVote(prevVote);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
          userVote === 1
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : "bg-white border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600"
        }`}
      >
        <svg className="w-4 h-4" fill={userVote === 1 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {t.likes.like}
      </button>
      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
          userVote === -1
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-white border-border text-muted-foreground hover:border-red-300 hover:text-red-600"
        }`}
      >
        <svg className="w-4 h-4 rotate-180" fill={userVote === -1 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
        {t.likes.dislike}
      </button>
      <span className="text-sm font-medium text-muted-foreground ml-2">
        {interpolate(t.likes.score, { count: likeCount })}
      </span>
    </div>
  );
}
