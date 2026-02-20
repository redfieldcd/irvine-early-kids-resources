"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-white border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/feedback"
              className="text-primary hover:text-primary-light transition-colors font-medium"
            >
              💬 {t.footer.feedback}
            </Link>
            <span className="text-border">|</span>
            <a
              href="mailto:cathy@biphoenixtrees.com"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              cathy@biphoenixtrees.com
            </a>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            <p>{t.footer.madeWith}</p>
            <p className="mt-1">{t.footer.helpingParents}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
