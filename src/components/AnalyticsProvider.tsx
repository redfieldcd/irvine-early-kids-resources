"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "page_view", page: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
