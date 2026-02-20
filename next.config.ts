import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/": ["./data/database.db"],
    "/categories/[slug]": ["./data/database.db"],
    "/resources/[id]": ["./data/database.db"],
    "/age-guide": ["./data/database.db"],
    "/api/**": ["./data/database.db"],
  },
};

export default nextConfig;
