"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function SubscribeForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.alreadySubscribed ? "already" : "success");
        if (!data.alreadySubscribed) setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 justify-center text-green-700 bg-green-50 rounded-full px-5 py-3 text-sm font-medium">
        <span>✓</span>
        <span>{t.home.subscribeSuccess}</span>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="flex items-center gap-2 justify-center text-blue-700 bg-blue-50 rounded-full px-5 py-3 text-sm font-medium">
        <span>✓</span>
        <span>{t.home.subscribeAlready}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
        placeholder={t.home.subscribePlaceholder}
        required
        className="flex-1 w-full px-4 py-3 rounded-full border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {status === "loading" ? t.home.subscribeLoading : t.home.subscribeButton}
      </button>
      {status === "error" && (
        <p className="text-red-500 text-xs mt-1 w-full text-center">{t.home.subscribeError}</p>
      )}
    </form>
  );
}
