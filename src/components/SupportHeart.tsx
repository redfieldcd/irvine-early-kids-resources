"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/helpers";

export default function SupportHeart() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);
  const [supported, setSupported] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/support")
      .then((r) => r.json())
      .then((data) => {
        setCount(data.count);
        setSupported(data.supported);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggleSupport = async () => {
    if (animating) return;
    setAnimating(true);

    // Optimistic update
    const newSupported = !supported;
    setSupported(newSupported);
    setCount((c) => c + (newSupported ? 1 : -1));

    try {
      const res = await fetch("/api/support", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCount(data.count);
        setSupported(data.supported);
      } else {
        // Revert
        setSupported(!newSupported);
        setCount((c) => c + (newSupported ? -1 : 1));
      }
    } catch {
      // Revert
      setSupported(!newSupported);
      setCount((c) => c + (newSupported ? -1 : 1));
    }

    setTimeout(() => setAnimating(false), 600);
  };

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-pink-50 animate-pulse" />
        <div className="w-24 h-4 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggleSupport}
        className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
          supported
            ? "bg-pink-100 shadow-md shadow-pink-200/50"
            : "bg-pink-50 hover:bg-pink-100 hover:shadow-md hover:shadow-pink-200/50"
        }`}
        aria-label={t.home.showSupport}
      >
        <span
          className={`text-3xl transition-transform duration-300 select-none ${
            animating ? "scale-125" : "scale-100"
          } ${supported ? "" : "group-hover:scale-110"}`}
        >
          {supported ? "❤️" : "🤍"}
        </span>
        {animating && supported && (
          <>
            <span className="absolute text-lg animate-ping opacity-60">❤️</span>
          </>
        )}
      </button>
      <p className="text-sm text-muted-foreground">
        {count > 0
          ? interpolate(t.home.supportCount, { count })
          : t.home.showSupport}
      </p>
    </div>
  );
}
