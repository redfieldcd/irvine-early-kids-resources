"use client";

import { useI18n } from "@/i18n/client";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-white border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-sm text-muted-foreground">
          <p>{t.footer.madeWith}</p>
          <p className="mt-1">{t.footer.helpingParents}</p>
        </div>
      </div>
    </footer>
  );
}
