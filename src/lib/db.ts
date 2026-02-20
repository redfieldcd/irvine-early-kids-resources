import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const sourceDbPath = path.join(process.cwd(), "data", "database.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    let dbPath = sourceDbPath;

    // On read-only filesystems (e.g., Vercel), copy the database to /tmp
    if (!isWritable(path.dirname(sourceDbPath))) {
      const tmpDbPath = "/tmp/database.db";
      if (!fs.existsSync(tmpDbPath)) {
        fs.copyFileSync(sourceDbPath, tmpDbPath);
      }
      dbPath = tmpDbPath;
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function isWritable(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export default getDb;
