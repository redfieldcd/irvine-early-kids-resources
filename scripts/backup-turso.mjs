/**
 * Backs up all user-generated data from Turso to a local JSON file.
 *
 * Usage:
 *   node scripts/backup-turso.mjs
 *
 * Output: data/backups/backup-YYYY-MM-DD-HHmmss.json
 *
 * To restore from a backup:
 *   node scripts/backup-turso.mjs --restore data/backups/backup-2026-02-20-143000.json
 */
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars");
  console.error("Tip: run with: export $(cat .env.local | xargs) && node scripts/backup-turso.mjs");
  process.exit(1);
}

const client = createClient({ url, authToken });

const isRestore = process.argv[2] === "--restore";
const restoreFile = process.argv[3];

async function backup() {
  console.log("Backing up Turso data...\n");

  const tables = ["likes", "comments", "analytics_events", "support_hearts", "subscribers"];
  const data = {
    backupDate: new Date().toISOString(),
    tables: {}
  };

  for (const table of tables) {
    try {
      const result = await client.execute(`SELECT * FROM ${table}`);
      const rows = result.rows.map((row) => {
        const obj = {};
        for (const col of result.columns) {
          obj[col] = row[col];
        }
        return obj;
      });
      data.tables[table] = rows;
      console.log(`  ${table}: ${rows.length} rows`);
    } catch (e) {
      console.log(`  ${table}: skipped (table may not exist)`);
      data.tables[table] = [];
    }
  }

  // Create backups directory
  const backupsDir = path.resolve(__dirname, "..", "data", "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Write backup file
  const now = new Date();
  const timestamp = now.toISOString().replace(/[T:]/g, "-").replace(/\..+/, "");
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(backupsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\nBackup saved to: ${filepath}`);

  // Also keep a "latest" copy
  const latestPath = path.join(backupsDir, "backup-latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  console.log(`Latest copy at:  ${latestPath}`);

  client.close();
}

async function restore() {
  if (!restoreFile) {
    console.error("Usage: node scripts/backup-turso.mjs --restore <path-to-backup.json>");
    process.exit(1);
  }

  const fullPath = path.resolve(restoreFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  console.log(`Restoring from backup: ${data.backupDate}\n`);

  for (const [table, rows] of Object.entries(data.tables)) {
    if (!rows.length) {
      console.log(`  ${table}: 0 rows — skipped`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const colNames = columns.join(", ");

    let inserted = 0;
    for (const row of rows) {
      try {
        await client.execute({
          sql: `INSERT OR IGNORE INTO ${table} (${colNames}) VALUES (${placeholders})`,
          args: columns.map((col) => row[col] ?? null),
        });
        inserted++;
      } catch (e) {
        // Skip duplicates silently
      }
    }
    console.log(`  ${table}: restored ${inserted}/${rows.length} rows`);
  }

  console.log("\nRestore complete!");
  client.close();
}

if (isRestore) {
  await restore();
} else {
  await backup();
}
