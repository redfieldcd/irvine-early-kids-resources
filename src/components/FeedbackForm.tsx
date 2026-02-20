"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function FeedbackForm() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedbackType, setFeedbackType] = useState("General Feedback");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, feedbackType, message }),
      });

      if (res.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
        setFeedbackType("General Feedback");
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t.feedback.errorGeneric);
        setStatus("error");
      }
    } catch {
      setErrorMsg(t.feedback.errorGeneric);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">{t.feedback.thankYou}</h3>
        <p className="text-muted-foreground mb-6">{t.feedback.thankYouMessage}</p>
        <button
          onClick={() => setStatus("idle")}
          className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          {t.feedback.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
          {t.feedback.nameLabel}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.feedback.namePlaceholder}
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
          {t.feedback.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.feedback.emailPlaceholder}
          maxLength={200}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>

      {/* Feedback Type */}
      <div>
        <label htmlFor="feedbackType" className="block text-sm font-medium text-foreground mb-1.5">
          {t.feedback.typeLabel}
        </label>
        <select
          id="feedbackType"
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        >
          <option value="General Feedback">{t.feedback.typeGeneral}</option>
          <option value="Resource Suggestion">{t.feedback.typeSuggestion}</option>
          <option value="Bug Report">{t.feedback.typeBug}</option>
          <option value="Partnership Inquiry">{t.feedback.typePartnership}</option>
          <option value="Other">{t.feedback.typeOther}</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1.5">
          {t.feedback.messageLabel} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.feedback.messagePlaceholder}
          maxLength={2000}
          rows={5}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-vertical"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{message.length}/2000</p>
      </div>

      {/* Error */}
      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "sending" || !message.trim()}
        className="w-full px-6 py-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? t.feedback.sending : t.feedback.submit}
      </button>
    </form>
  );
}
