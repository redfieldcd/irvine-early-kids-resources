/**
 * Creates user-generated-data tables in Turso.
 * Run once (or idempotently) to set up the remote database.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/seed-turso.mjs
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars");
  process.exit(1);
}

const client = createClient({ url, authToken });

const statements = [
  `CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    value INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(resource_id, session_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    nickname TEXT DEFAULT 'Anonymous Parent',
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    resource_id INTEGER,
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_likes_resource ON likes(resource_id)`,
  `CREATE INDEX IF NOT EXISTS idx_likes_unique ON likes(resource_id, session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_id)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_resource ON analytics_events(resource_id)`,
];

console.log("Creating Turso tables...");

for (const sql of statements) {
  await client.execute(sql);
  const tableName = sql.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1];
  console.log(`  ✓ ${tableName}`);
}

console.log("\nTurso tables ready!");
client.close();
