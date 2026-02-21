/**
 * Tool definitions and implementations for the AI CLI.
 * Each tool has a schema (for Claude) and a handler (executed locally).
 */
import { createRequire } from "module";
import { createClient } from "@libsql/client";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// --- Database connections ---

let _turso;
function getTurso() {
  if (!_turso) {
    _turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _turso;
}

let _sqlite;
function getSqlite() {
  if (!_sqlite) {
    const Database = require("better-sqlite3");
    const dbPath = path.join(PROJECT_ROOT, "data", "database.db");
    _sqlite = new Database(dbPath);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
  }
  return _sqlite;
}

// --- Tool Definitions (JSON Schema for Claude) ---

export const toolDefinitions = [
  {
    name: "list_resources",
    description: "List resources in the database, optionally filtered by category or search term. Use this to see what resources exist.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category slug: 'mandarin-study' or 'preschools'" },
        search: { type: "string", description: "Search resources by name (partial match)" },
        limit: { type: "number", description: "Max number of results (default 20)" },
      },
    },
  },
  {
    name: "get_resource",
    description: "Get full details of a specific resource by ID or name.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Resource ID" },
        name: { type: "string", description: "Resource name (partial match)" },
      },
    },
  },
  {
    name: "add_resource",
    description: "Add a new resource to the database. Requires name, category, and other details.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Resource name" },
        category_slug: { type: "string", description: "Category slug: 'mandarin-study' or 'preschools'" },
        type: { type: "string", description: "Resource type (e.g., 'Montessori', 'Language School')" },
        age_group: { type: "string", description: "Target age group (e.g., 'PreK', '2-6 years')" },
        description: { type: "string", description: "Description of the resource" },
        key_topics: { type: "string", description: "Key topics or focus areas" },
        schedule: { type: "string", description: "Operating hours/schedule" },
        cost: { type: "string", description: "Cost information" },
        website: { type: "string", description: "Website URL" },
        location: { type: "string", description: "Physical address" },
        subcategory: { type: "string", description: "Subcategory name (e.g., 'Irvine', 'Tustin')" },
      },
      required: ["name", "category_slug", "type", "description", "cost"],
    },
  },
  {
    name: "update_resource",
    description: "Update an existing resource. Provide the resource ID and the fields to update.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Resource ID to update" },
        name: { type: "string" },
        type: { type: "string" },
        age_group: { type: "string" },
        description: { type: "string" },
        key_topics: { type: "string" },
        schedule: { type: "string" },
        cost: { type: "string" },
        website: { type: "string" },
        location: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_resource",
    description: "Remove a resource from the database by ID.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Resource ID to remove" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_categories",
    description: "List all categories with resource counts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "analytics_overview",
    description: "Get site analytics overview: page views, visitors, clicks, likes, comments, support hearts.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back (default 30)" },
      },
    },
  },
  {
    name: "analytics_top_pages",
    description: "Get the most viewed pages.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back (default 30)" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "analytics_top_resources",
    description: "Get the most popular resources by clicks, likes, or comments.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["clicks", "likes", "comments"], description: "Which metric to rank by" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "analytics_daily_views",
    description: "Get daily page view counts for a time range.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days (default 14)" },
      },
    },
  },
  {
    name: "list_comments",
    description: "List recent comments, optionally filtered by resource.",
    input_schema: {
      type: "object",
      properties: {
        resource_id: { type: "number", description: "Filter by resource ID" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "backup_database",
    description: "Run a backup of the Turso database (user data: likes, comments, analytics, support hearts).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "deploy_site",
    description: "Deploy the site to Vercel production. Rebuilds the database from Excel and deploys.",
    input_schema: {
      type: "object",
      properties: {
        skip_seed: { type: "boolean", description: "Skip re-seeding the database (default false)" },
      },
    },
  },
  {
    name: "check_broken_links",
    description: "Check all resource website URLs for broken links.",
    input_schema: {
      type: "object",
      properties: {
        category_slug: { type: "string", description: "Only check resources in this category" },
      },
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the project directory. Use for git, npm, or other project operations.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
];

// --- Tool Handlers ---

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 100);
}

export const toolHandlers = {
  async list_resources({ category, search, limit = 20 }) {
    const db = getSqlite();
    let sql = `SELECT r.id, r.name, r.type, r.age_group, r.cost, r.website, c.name as category
               FROM resources r JOIN categories c ON r.category_id = c.id`;
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push("c.slug = ?");
      params.push(category);
    }
    if (search) {
      conditions.push("r.name LIKE ?");
      params.push(`%${search}%`);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY r.sort_order LIMIT ?";
    params.push(limit);

    const rows = db.prepare(sql).all(...params);
    return JSON.stringify(rows, null, 2);
  },

  async get_resource({ id, name }) {
    const db = getSqlite();
    let row;
    if (id) {
      row = db.prepare("SELECT r.*, c.name as category, c.slug as category_slug FROM resources r JOIN categories c ON r.category_id = c.id WHERE r.id = ?").get(id);
    } else if (name) {
      row = db.prepare("SELECT r.*, c.name as category, c.slug as category_slug FROM resources r JOIN categories c ON r.category_id = c.id WHERE r.name LIKE ?").get(`%${name}%`);
    }
    if (!row) return "Resource not found.";

    // Also fetch Turso data
    try {
      const turso = getTurso();
      const [likes, comments] = await Promise.all([
        turso.execute({ sql: "SELECT SUM(value) as score, COUNT(*) as votes FROM likes WHERE resource_id = ?", args: [row.id] }),
        turso.execute({ sql: "SELECT COUNT(*) as count FROM comments WHERE resource_id = ?", args: [row.id] }),
      ]);
      row.like_score = Number(likes.rows[0]?.score ?? 0);
      row.total_votes = Number(likes.rows[0]?.votes ?? 0);
      row.comment_count = Number(comments.rows[0]?.count ?? 0);
    } catch (e) {
      // Turso unavailable, just return SQLite data
    }
    return JSON.stringify(row, null, 2);
  },

  async add_resource({ name, category_slug, type, age_group = "", description, key_topics = "", schedule, cost, website, location, subcategory }) {
    const db = getSqlite();
    const cat = db.prepare("SELECT id FROM categories WHERE slug = ?").get(category_slug);
    if (!cat) return `Error: Category '${category_slug}' not found. Available: mandarin-study, preschools`;

    let subcategoryId = null;
    if (subcategory) {
      const sub = db.prepare("SELECT id FROM subcategories WHERE category_id = ? AND name LIKE ?").get(cat.id, `%${subcategory}%`);
      if (sub) subcategoryId = sub.id;
    }

    const slug = toSlug(name);
    const maxOrder = db.prepare("SELECT MAX(sort_order) as m FROM resources WHERE category_id = ?").get(cat.id);
    const sortOrder = (maxOrder?.m || 0) + 1;

    const result = db.prepare(
      `INSERT INTO resources (name, slug, type, age_group, description, key_topics, schedule, cost, website, location, category_id, subcategory_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, slug, type, age_group, description, key_topics, schedule || null, cost, website || null, location || null, cat.id, subcategoryId, sortOrder);

    return `Added resource "${name}" with ID ${result.lastInsertRowid}. Remember to deploy for changes to go live.`;
  },

  async update_resource({ id, ...fields }) {
    const db = getSqlite();
    const existing = db.prepare("SELECT * FROM resources WHERE id = ?").get(id);
    if (!existing) return `Error: Resource ID ${id} not found.`;

    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (updates.length === 0) return "No fields to update.";

    params.push(id);
    db.prepare(`UPDATE resources SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    return `Updated resource "${existing.name}" (ID ${id}). Fields changed: ${Object.keys(fields).filter(k => fields[k] !== undefined).join(", ")}. Remember to deploy for changes to go live.`;
  },

  async remove_resource({ id }) {
    const db = getSqlite();
    const existing = db.prepare("SELECT name FROM resources WHERE id = ?").get(id);
    if (!existing) return `Error: Resource ID ${id} not found.`;

    db.prepare("DELETE FROM resources WHERE id = ?").run(id);
    return `Removed resource "${existing.name}" (ID ${id}). Remember to deploy for changes to go live.`;
  },

  async list_categories() {
    const db = getSqlite();
    const rows = db.prepare(
      "SELECT c.id, c.name, c.slug, c.target_age_groups, (SELECT COUNT(*) FROM resources WHERE category_id = c.id) as resource_count FROM categories c ORDER BY sort_order"
    ).all();
    return JSON.stringify(rows, null, 2);
  },

  async analytics_overview({ days = 30 } = {}) {
    const turso = getTurso();
    const timeFilter = `AND created_at >= datetime('now', '-${days} days')`;

    const [views, clicks, visitors, likes, comments, hearts] = await Promise.all([
      turso.execute(`SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'page_view' ${timeFilter}`),
      turso.execute(`SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'outbound_click' ${timeFilter}`),
      turso.execute(`SELECT COUNT(DISTINCT session_id) as c FROM analytics_events WHERE 1=1 ${timeFilter}`),
      turso.execute("SELECT COUNT(*) as c FROM likes WHERE value = 1"),
      turso.execute("SELECT COUNT(*) as c FROM comments"),
      turso.execute("SELECT COUNT(*) as c FROM support_hearts"),
    ]);

    return JSON.stringify({
      period: `Last ${days} days`,
      pageViews: Number(views.rows[0]?.c ?? 0),
      outboundClicks: Number(clicks.rows[0]?.c ?? 0),
      uniqueVisitors: Number(visitors.rows[0]?.c ?? 0),
      totalLikes: Number(likes.rows[0]?.c ?? 0),
      totalComments: Number(comments.rows[0]?.c ?? 0),
      supportHearts: Number(hearts.rows[0]?.c ?? 0),
    }, null, 2);
  },

  async analytics_top_pages({ days = 30, limit = 10 } = {}) {
    const turso = getTurso();
    const result = await turso.execute({
      sql: `SELECT page, COUNT(*) as views FROM analytics_events
            WHERE event_type = 'page_view' AND created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY page ORDER BY views DESC LIMIT ?`,
      args: [days, limit],
    });
    return JSON.stringify(result.rows.map(r => ({ page: r.page, views: Number(r.views) })), null, 2);
  },

  async analytics_top_resources({ metric = "clicks", limit = 10 } = {}) {
    const turso = getTurso();
    const db = getSqlite();
    let rows;

    if (metric === "clicks") {
      const result = await turso.execute({
        sql: `SELECT resource_id, COUNT(*) as count FROM analytics_events
              WHERE event_type = 'outbound_click' AND resource_id IS NOT NULL
              GROUP BY resource_id ORDER BY count DESC LIMIT ?`,
        args: [limit],
      });
      rows = result.rows;
    } else if (metric === "likes") {
      const result = await turso.execute({
        sql: "SELECT resource_id, SUM(value) as count FROM likes GROUP BY resource_id ORDER BY count DESC LIMIT ?",
        args: [limit],
      });
      rows = result.rows;
    } else {
      const result = await turso.execute({
        sql: "SELECT resource_id, COUNT(*) as count FROM comments GROUP BY resource_id ORDER BY count DESC LIMIT ?",
        args: [limit],
      });
      rows = result.rows;
    }

    // Enrich with names
    const enriched = rows.map(r => {
      const resource = db.prepare("SELECT name FROM resources WHERE id = ?").get(Number(r.resource_id));
      return { resourceId: Number(r.resource_id), name: resource?.name || `#${r.resource_id}`, [metric]: Number(r.count) };
    });
    return JSON.stringify(enriched, null, 2);
  },

  async analytics_daily_views({ days = 14 } = {}) {
    const turso = getTurso();
    const result = await turso.execute({
      sql: `SELECT DATE(created_at) as date, COUNT(*) as views FROM analytics_events
            WHERE event_type = 'page_view' AND created_at >= datetime('now', '-' || ? || ' days')
            GROUP BY DATE(created_at) ORDER BY date`,
      args: [days],
    });
    const data = result.rows.map(r => ({ date: r.date, views: Number(r.views) }));

    // ASCII chart
    if (data.length > 0) {
      const max = Math.max(...data.map(d => d.views));
      const barWidth = 30;
      let chart = "\n";
      for (const d of data) {
        const bar = "█".repeat(Math.round((d.views / max) * barWidth));
        chart += `  ${String(d.date).slice(5)} │${bar} ${d.views}\n`;
      }
      return chart;
    }
    return JSON.stringify(data, null, 2);
  },

  async list_comments({ resource_id, limit = 20 } = {}) {
    const turso = getTurso();
    const db = getSqlite();
    let result;
    if (resource_id) {
      result = await turso.execute({
        sql: "SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at DESC LIMIT ?",
        args: [resource_id, limit],
      });
    } else {
      result = await turso.execute({
        sql: "SELECT * FROM comments ORDER BY created_at DESC LIMIT ?",
        args: [limit],
      });
    }
    const comments = result.rows.map(r => {
      const resource = db.prepare("SELECT name FROM resources WHERE id = ?").get(Number(r.resource_id));
      return {
        id: Number(r.id),
        resource: resource?.name || `#${r.resource_id}`,
        nickname: r.nickname,
        body: r.body,
        createdAt: r.created_at,
      };
    });
    return JSON.stringify(comments, null, 2);
  },

  async backup_database() {
    try {
      const output = execSync("node scripts/backup-turso.mjs", {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        encoding: "utf-8",
      });
      return output;
    } catch (e) {
      return `Backup failed: ${e.message}`;
    }
  },

  async deploy_site({ skip_seed = false } = {}) {
    try {
      const steps = [];
      if (!skip_seed) {
        steps.push("Re-seeding database...");
        execSync("rm -f data/database.db && node scripts/seed.mjs", { cwd: PROJECT_ROOT, encoding: "utf-8" });
        steps.push("Database seeded.");
      }
      steps.push("Deploying to Vercel...");
      const output = execSync("npx vercel --prod 2>&1", { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 180000 });
      const urlMatch = output.match(/Production: (https:\/\/\S+)/);
      steps.push(urlMatch ? `Deployed: ${urlMatch[1]}` : "Deployed successfully.");
      return steps.join("\n");
    } catch (e) {
      return `Deploy failed: ${e.stderr || e.message}`;
    }
  },

  async check_broken_links({ category_slug } = {}) {
    const db = getSqlite();
    let sql = "SELECT r.id, r.name, r.website FROM resources r";
    const params = [];
    if (category_slug) {
      sql += " JOIN categories c ON r.category_id = c.id WHERE c.slug = ? AND r.website IS NOT NULL AND r.website != ''";
      params.push(category_slug);
    } else {
      sql += " WHERE r.website IS NOT NULL AND r.website != ''";
    }
    const resources = db.prepare(sql).all(...params);

    const results = [];
    for (const r of resources) {
      let url = r.website;
      if (!url.startsWith("http")) url = "https://" + url;
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });
        if (!response.ok) {
          results.push({ id: r.id, name: r.name, url, status: response.status, broken: true });
        }
      } catch (e) {
        results.push({ id: r.id, name: r.name, url, error: e.message || "Connection failed", broken: true });
      }
    }

    if (results.length === 0) return `All ${resources.length} links are working.`;
    return `Found ${results.length} broken link(s) out of ${resources.length} checked:\n\n` +
      JSON.stringify(results, null, 2);
  },

  async run_command({ command }) {
    // Safety: block dangerous commands
    const blocked = ["rm -rf /", "rm -rf ~", "sudo", "chmod 777"];
    if (blocked.some(b => command.includes(b))) {
      return "Error: This command is blocked for safety.";
    }
    try {
      const output = execSync(command, { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 30000 });
      return output || "(no output)";
    } catch (e) {
      return `Command failed (exit ${e.status}): ${e.stderr || e.message}`;
    }
  },
};
