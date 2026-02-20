"use client";

interface OutboundLinkProps {
  href: string;
  resourceId: number;
  children: React.ReactNode;
}

export default function OutboundLink({ href, resourceId, children }: OutboundLinkProps) {
  function handleClick() {
    const url = href.startsWith("http") ? href : `https://${href}`;
    navigator.sendBeacon(
      "/api/analytics",
      JSON.stringify({
        eventType: "outbound_click",
        resourceId,
        page: window.location.pathname,
        metadata: { url },
      })
    );
  }

  const fullUrl = href.startsWith("http") ? href : `https://${href}`;

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
    >
      {children}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
