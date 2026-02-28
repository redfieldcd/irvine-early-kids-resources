import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import FeedbackForm from "@/components/FeedbackForm";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.feedback.pageTitle,
    description: t.feedback.pageDescription,
    alternates: {
      canonical: `${SITE_URL}/feedback`,
    },
  };
}

export default async function FeedbackPage() {
  const t = await getDictionary();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary transition-colors">{t.feedback.breadcrumbHome}</Link>
        <span>/</span>
        <span className="text-foreground">{t.feedback.breadcrumbFeedback}</span>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">💬</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{t.feedback.title}</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">{t.feedback.subtitle}</p>
      </div>

      {/* Form Card */}
      <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
        <FeedbackForm />
      </div>

      {/* Contact Info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>{t.feedback.directEmail}</p>
        <a
          href="mailto:cathy@biphoenixtrees.com"
          className="text-primary hover:text-primary-light transition-colors font-medium"
        >
          cathy@biphoenixtrees.com
        </a>
      </div>
    </div>
  );
}
