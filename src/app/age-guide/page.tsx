import Link from "next/link";
import getDb from "@/lib/db";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { SITE_URL } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: "Age Group Guide",
    description: t.meta.ageGuideDescription,
    alternates: {
      canonical: `${SITE_URL}/age-guide`,
    },
  };
}

interface AgeGuide {
  id: number;
  age_group: string;
  developmental_focus: string;
  mandarin_options: string;
  sort_order: number;
}

const ageColors = [
  "border-l-pink-400",
  "border-l-rose-400",
  "border-l-orange-400",
  "border-l-amber-400",
  "border-l-yellow-400",
  "border-l-lime-400",
  "border-l-green-400",
];

export default async function AgeGuidePage() {
  const db = getDb();
  const t = await getDictionary();
  const guides = db.prepare(
    "SELECT * FROM age_group_guides ORDER BY sort_order"
  ).all() as AgeGuide[];

  const categoryItems = [
    { label: t.ageGuide.mandarinOptions, key: "mandarin_options" as const, link: "/categories/mandarin-study" },
  ];

  return (
    <div>
      <section className="bg-gradient-to-br from-violet-50 via-white to-blue-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">{t.ageGuide.breadcrumbHome}</Link>
            <span>/</span>
            <span className="text-foreground">{t.ageGuide.breadcrumbAgeGuide}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{t.ageGuide.title}</h1>
          <p className="text-muted-foreground max-w-2xl">
            {t.ageGuide.subtitle}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {guides.map((guide, idx) => (
            <div
              key={guide.id}
              className={`bg-card rounded-xl border border-border ${ageColors[idx % ageColors.length]} border-l-4 p-6`}
            >
              <h2 className="text-xl font-bold text-foreground mb-2">{guide.age_group}</h2>
              <p className="text-sm text-muted-foreground mb-5">{guide.developmental_focus}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryItems.map(({ label, key, link }) => (
                  <div key={key} className="bg-muted rounded-lg p-3">
                    <Link
                      href={link}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {label}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                      {guide[key] || t.ageGuide.notAvailable}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
