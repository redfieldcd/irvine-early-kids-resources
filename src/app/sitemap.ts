import type { MetadataRoute } from "next";
import getDb from "@/lib/db";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const db = getDb();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/age-guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/feedback`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categories = db
    .prepare("SELECT slug FROM categories ORDER BY sort_order")
    .all() as { slug: string }[];

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${SITE_URL}/categories/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const resources = db
    .prepare("SELECT id FROM resources ORDER BY id")
    .all() as { id: number }[];

  const resourcePages: MetadataRoute.Sitemap = resources.map((r) => ({
    url: `${SITE_URL}/resources/${r.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...resourcePages];
}
