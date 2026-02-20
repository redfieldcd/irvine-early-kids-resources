"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { t, toggleLocale } = useI18n();

  const categories = [
    { name: t.nav.mandarinStudy, slug: "mandarin-study" },
    { name: t.nav.preschools, slug: "preschools" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="font-bold text-lg text-foreground hidden sm:block">
              {t.nav.siteName}
            </span>
            <span className="font-bold text-lg text-foreground sm:hidden">
              {t.nav.siteNameShort}
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/age-guide"
              className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
            >
              {t.nav.ageGuide}
            </Link>
            <Link
              href="/feedback"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {t.footer.feedback}
            </Link>
            <button
              onClick={toggleLocale}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
              aria-label="Switch language"
            >
              {t.language.switchLabel}
            </button>
          </div>

          {/* Mobile: language toggle + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleLocale}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
              aria-label="Switch language"
            >
              {t.language.switchLabel}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={t.nav.toggleMenu}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="px-4 py-3 space-y-2">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                onClick={() => setOpen(false)}
                className="block py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/age-guide"
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-primary"
            >
              {t.nav.ageGuide}
            </Link>
            <Link
              href="/feedback"
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-primary"
            >
              {t.footer.feedback}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
