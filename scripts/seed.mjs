import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "data", "database.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Create tables
db.exec(`
  DROP TABLE IF EXISTS analytics_events;
  DROP TABLE IF EXISTS comments;
  DROP TABLE IF EXISTS likes;
  DROP TABLE IF EXISTS resources;
  DROP TABLE IF EXISTS subcategories;
  DROP TABLE IF EXISTS age_group_guides;
  DROP TABLE IF EXISTS categories;

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    target_age_groups TEXT NOT NULL,
    key_focus_areas TEXT NOT NULL,
    resource_count TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    UNIQUE(category_id, slug)
  );

  CREATE TABLE resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    age_group TEXT NOT NULL,
    description TEXT NOT NULL,
    key_topics TEXT NOT NULL,
    schedule TEXT,
    cost TEXT NOT NULL,
    website TEXT,
    location TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    sort_order INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    session_id TEXT NOT NULL,
    value INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(resource_id, session_id)
  );

  CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    session_id TEXT NOT NULL,
    nickname TEXT DEFAULT 'Anonymous Parent',
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE age_group_guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    age_group TEXT UNIQUE NOT NULL,
    developmental_focus TEXT NOT NULL,
    sibling_resources TEXT NOT NULL,
    parenting_resources TEXT NOT NULL,
    mandarin_options TEXT NOT NULL,
    aftercare_options TEXT NOT NULL,
    weekend_activities TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    resource_id INTEGER REFERENCES resources(id),
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_resources_category ON resources(category_id);
  CREATE INDEX idx_resources_subcategory ON resources(subcategory_id);
  CREATE INDEX idx_likes_resource ON likes(resource_id);
  CREATE INDEX idx_comments_resource ON comments(resource_id);
  CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
  CREATE INDEX idx_analytics_resource ON analytics_events(resource_id);
`);

console.log("Created database tables.");

const SHEET_CONFIGS = {
  "1. Sibling Relationships": {
    slug: "sibling-relationships",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Age Group",
      description: "Description", keyTopics: "Key Topics",
      schedule: null, cost: "Cost", website: "Website / Contact", location: "Location",
    },
  },
  "2. Parenting Techniques": {
    slug: "parenting-techniques",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Target Audience",
      description: "Description", keyTopics: "Key Topics / Curriculum",
      schedule: null, cost: "Cost", website: "Website / Contact", location: "Location",
    },
  },
  "3. Mandarin Study": {
    slug: "mandarin-study",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Age Group",
      description: "Description", keyTopics: "Curriculum / Approach",
      schedule: "Schedule", cost: "Cost", website: "Website / Contact", location: "Location",
    },
  },
  "4. Aftercare Programs": {
    slug: "aftercare-programs",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Age Group",
      description: "Description", keyTopics: "Activities / Focus",
      schedule: "Hours", cost: "Cost", website: "Website / Contact", location: "Location",
    },
  },
  "5. Weekend Activities": {
    slug: "weekend-activities",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Age Group",
      description: "Description", keyTopics: "Best For",
      schedule: null, cost: "Cost", website: "Website / Contact", location: "Location",
    },
  },
};

function isSectionHeader(row) {
  const values = Object.values(row);
  const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  return nonEmpty.length === 1 && typeof values[0] === "string";
}

// Prepared statements
const insertCategory = db.prepare(`
  INSERT INTO categories (name, slug, description, target_age_groups, key_focus_areas, resource_count, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertSubcategory = db.prepare(`
  INSERT INTO subcategories (name, slug, sort_order, category_id)
  VALUES (?, ?, ?, ?)
`);

const insertResource = db.prepare(`
  INSERT INTO resources (name, slug, type, age_group, description, key_topics, schedule, cost, website, location, category_id, subcategory_id, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAgeGuide = db.prepare(`
  INSERT INTO age_group_guides (age_group, developmental_focus, sibling_resources, parenting_resources, mandarin_options, aftercare_options, weekend_activities, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Read Excel file
const xlsxPath = path.join(__dirname, "..", "data", "irvine_kids_learning_resources.xlsx");
const workbook = XLSX.readFile(xlsxPath);

// Seed categories
const overviewSheet = workbook.Sheets["Overview"];
const overviewRows = XLSX.utils.sheet_to_json(overviewSheet);
const categoryMap = {};

const seedCategories = db.transaction(() => {
  for (let i = 0; i < overviewRows.length; i++) {
    const row = overviewRows[i];
    const verticalName = row["Vertical"] || "";
    const cleanName = verticalName.replace(/^\d+\.\s*/, "");
    const slug = toSlug(cleanName);
    const result = insertCategory.run(
      cleanName, slug,
      row["Description"] || "",
      row["Target Age Groups"] || "",
      row["Key Focus Areas"] || "",
      String(row["# of Resources Listed"] || "0"),
      i + 1
    );
    categoryMap[slug] = result.lastInsertRowid;
    console.log(`Created category: ${cleanName} (id=${result.lastInsertRowid})`);
  }
});
seedCategories();

// Seed resources
const globalUsedSlugs = new Set();

const seedResources = db.transaction(() => {
  for (const [sheetName, config] of Object.entries(SHEET_CONFIGS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.warn(`Sheet not found: ${sheetName}`); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet);
    const categoryId = categoryMap[config.slug];
    if (!categoryId) { console.warn(`Category not found: ${config.slug}`); continue; }

    let currentSubcategoryId = null;
    let subcategoryOrder = 0;
    let resourceOrder = 0;

    for (const row of rows) {
      if (isSectionHeader(row)) {
        const headerName = String(Object.values(row)[0]).trim();
        subcategoryOrder++;
        const subSlug = toSlug(headerName);
        const result = insertSubcategory.run(headerName, subSlug, subcategoryOrder, categoryId);
        currentSubcategoryId = result.lastInsertRowid;
        console.log(`  Subcategory: ${headerName}`);
        continue;
      }

      const name = row[config.columns.name];
      const type = row[config.columns.type];
      if (!name || !type) continue;

      resourceOrder++;
      let slug = toSlug(String(name));
      while (globalUsedSlugs.has(slug)) {
        slug = `${toSlug(String(name))}-${resourceOrder}`;
      }
      globalUsedSlugs.add(slug);

      const scheduleCol = config.columns.schedule;
      const scheduleVal = scheduleCol ? String(row[scheduleCol] || "") || null : null;

      insertResource.run(
        String(name), slug, String(type),
        String(row[config.columns.ageGroup] || ""),
        String(row[config.columns.description] || ""),
        String(row[config.columns.keyTopics] || ""),
        scheduleVal,
        String(row[config.columns.cost] || ""),
        String(row[config.columns.website] || "") || null,
        String(row[config.columns.location] || "") || null,
        categoryId, currentSubcategoryId, resourceOrder
      );
      console.log(`    Resource: ${name}`);
    }
  }
});
seedResources();

// Seed Age Group Guide
const ageGuideSheet = workbook.Sheets["Age Group Guide"];
const ageGuideRows = XLSX.utils.sheet_to_json(ageGuideSheet);

const seedAgeGuide = db.transaction(() => {
  for (let i = 0; i < ageGuideRows.length; i++) {
    const row = ageGuideRows[i];
    insertAgeGuide.run(
      row["Age Group"] || "",
      row["Developmental Focus"] || "",
      row["Sibling Resources"] || "",
      row["Parenting Resources"] || "",
      row["Mandarin Study Options"] || "",
      row["Aftercare Options"] || "",
      row["Weekend Activities"] || "",
      i + 1
    );
    console.log(`Age Group Guide: ${row["Age Group"]}`);
  }
});
seedAgeGuide();

// Seed Preschools from separate Excel file
const preschoolXlsxPath = path.join(__dirname, "..", "data", "irvine_tustin_preschools.xlsx");
const preschoolWorkbook = XLSX.readFile(preschoolXlsxPath);
const preschoolSheetName = preschoolWorkbook.SheetNames[0];
const preschoolSheet = preschoolWorkbook.Sheets[preschoolSheetName];
const preschoolRows = XLSX.utils.sheet_to_json(preschoolSheet);

const seedPreschools = db.transaction(() => {
  // Create preschools category
  const preschoolResult = insertCategory.run(
    "Preschools",
    "preschools",
    "Preschool and early learning programs in Irvine & Tustin — Montessori, play-based, co-op, faith-based, public, and bilingual options.",
    "2-6 years",
    "Preschool, PreK, TK, Kindergarten, Montessori, Play-based, Bilingual",
    String(preschoolRows.length),
    Object.keys(SHEET_CONFIGS).length + 1
  );
  const preschoolCategoryId = preschoolResult.lastInsertRowid;
  console.log(`Created category: Preschools (id=${preschoolCategoryId})`);

  // Create subcategories by area
  const areas = [...new Set(preschoolRows.map(r => r["Area"]).filter(Boolean))];
  const areaSubcategoryMap = {};
  let subOrder = 0;
  for (const area of areas) {
    subOrder++;
    const result = insertSubcategory.run(area, toSlug(area), subOrder, preschoolCategoryId);
    areaSubcategoryMap[area] = result.lastInsertRowid;
    console.log(`  Subcategory: ${area}`);
  }

  // Seed preschool resources
  let resourceOrder = 0;
  for (const row of preschoolRows) {
    const name = row["School Name"];
    if (!name) continue;

    resourceOrder++;
    let slug = toSlug(String(name));
    while (globalUsedSlugs.has(slug)) {
      slug = `${toSlug(String(name))}-${resourceOrder}`;
    }
    globalUsedSlugs.add(slug);

    const typeNotes = String(row["Type / Notes"] || "Preschool");
    const programs = String(row["Programs (PreK/TK/KD)"] || "");
    const googleRating = row["Google Rating"];
    const googleReviews = row["Google Reviews"];
    const communityNotes = row["Community Notes (TalkIrvine/小红书/Forums)"] || "";
    const waitlistStatus = row["⏳ Waitlist Status"] || "";
    const yelpTop10 = row["Yelp Top 10"] || "";
    const area = row["Area"] || "";

    // Build description from available data
    const descParts = [];
    descParts.push(typeNotes);
    if (programs) descParts.push(`Programs: ${programs}`);
    if (googleRating && googleRating !== "N/A") descParts.push(`Google Rating: ${googleRating}/5 (${googleReviews || 0} reviews)`);
    if (yelpTop10) descParts.push(`Yelp Top 10: ${yelpTop10}`);
    if (communityNotes) descParts.push(communityNotes);
    const description = descParts.join(". ");

    // Build key topics from type/notes and waitlist
    const topicParts = [typeNotes];
    if (waitlistStatus) topicParts.push(`Waitlist: ${waitlistStatus.split("\n")[0]}`);
    const keyTopics = topicParts.join("; ");

    const website = String(row["Website"] || "") || null;
    const address = String(row["Address"] || "") || null;
    const hours = String(row["Hours"] || "") || null;
    const cost = String(row["Price Range (Monthly)"] || "Contact school");

    const subcategoryId = areaSubcategoryMap[area] || null;

    insertResource.run(
      String(name), slug, typeNotes, programs || "PreK",
      description, keyTopics, hours, cost,
      website, address,
      preschoolCategoryId, subcategoryId, resourceOrder
    );
    console.log(`    Resource: ${name}`);
  }
});
seedPreschools();

// Print summary
const catCount = db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
const subCount = db.prepare("SELECT COUNT(*) as c FROM subcategories").get().c;
const resCount = db.prepare("SELECT COUNT(*) as c FROM resources").get().c;
const ageCount = db.prepare("SELECT COUNT(*) as c FROM age_group_guides").get().c;

console.log(`\nSeeding complete!`);
console.log(`  Categories: ${catCount}`);
console.log(`  Subcategories: ${subCount}`);
console.log(`  Resources: ${resCount}`);
console.log(`  Age Group Guides: ${ageCount}`);

db.close();
