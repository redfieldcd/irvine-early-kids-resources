import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "database.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath, { readonly: false });
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export default getDb;
