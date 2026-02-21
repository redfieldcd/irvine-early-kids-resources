import Link from "next/link";
import getDb from "@/lib/db";
import { getDictionary } from "@/i18n/server";
import { interpolate } from "@/i18n/helpers";
import SupportHeart from "@/components/SupportHeart";
import SubscribeForm from "@/components/SubscribeForm";

const categoryConfig: Record<string, { icon: string; bgColor: string }> = {
  "mandarin-study": { icon: "🇨🇳", bgColor: "bg-amber-50" },
  "preschools": { icon: "🎒", bgColor: "bg-purple-50" },
};

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  target_age_groups: string;
  actual_count: number;
}

export default async function Home() {
  const db = getDb();
  const t = await getDictionary();
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM resources WHERE category_id = c.id) as actual_count
    FROM categories c ORDER BY sort_order
  `).all() as Category[];

  const totalResources = (db.prepare("SELECT COUNT(*) as cnt FROM resources").get() as { cnt: number }).cnt;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-pink-50 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            {t.home.heroTitle}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t.home.heroSubtitle}
          </p>
          <Link
            href="/age-guide"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary-light transition-colors"
          >
            {t.home.browseByAge}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-8 text-center">
          <p className="text-base sm:text-lg text-foreground leading-relaxed">
            {t.home.missionStatement}
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            {t.home.launchNote}
          </p>
          <div className="mt-6">
            <SupportHeart />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
          {t.home.exploreCategories}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {categories.map((cat) => {
            const config = categoryConfig[cat.slug] || { icon: "📁", bgColor: "bg-gray-50" };
            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group block bg-card rounded-xl border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-200"
              >
                <div className={`w-14 h-14 ${config.bgColor} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {config.icon}
                </div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{cat.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {interpolate(t.home.resourceCount, { count: cat.actual_count })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {interpolate(t.home.ages, { ages: cat.target_age_groups })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">{totalResources}+</div>
              <div className="text-sm text-muted-foreground mt-1">{t.home.statsResources}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-secondary">{categories.length}</div>
              <div className="text-sm text-muted-foreground mt-1">{t.home.statsCategories}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent">0-7</div>
              <div className="text-sm text-muted-foreground mt-1">{t.home.statsAgeRange}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-500">Irvine</div>
              <div className="text-sm text-muted-foreground mt-1">{t.home.statsOrangeCounty}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Subscribe */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-14 border-t border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t.home.subscribeTitle}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t.home.subscribeSubtitle}
          </p>
          <SubscribeForm />
        </div>
      </section>
    </div>
  );
}
