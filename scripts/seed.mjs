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

// Create tables (also drop legacy user-data tables that may exist from older schema)
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

  CREATE TABLE age_group_guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    age_group TEXT UNIQUE NOT NULL,
    developmental_focus TEXT NOT NULL,
    mandarin_options TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE INDEX idx_resources_category ON resources(category_id);
  CREATE INDEX idx_resources_subcategory ON resources(subcategory_id);
`);

console.log("Created database tables.");

const SHEET_CONFIGS = {
  "3. Mandarin Study": {
    slug: "mandarin-study",
    columns: {
      name: "Resource Name", type: "Type", ageGroup: "Age Group",
      description: "Description", keyTopics: "Curriculum / Approach",
      schedule: "Schedule", cost: "Cost", website: "Website / Contact", location: "Location",
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
  INSERT INTO age_group_guides (age_group, developmental_focus, mandarin_options, sort_order)
  VALUES (?, ?, ?, ?)
`);

// Read Excel file
const xlsxPath = path.join(__dirname, "..", "data", "irvine_kids_learning_resources.xlsx");
const workbook = XLSX.readFile(xlsxPath);

// Seed categories
const overviewSheet = workbook.Sheets["Overview"];
const overviewRows = XLSX.utils.sheet_to_json(overviewSheet);
const categoryMap = {};
const REMOVED_SLUGS = new Set(["sibling-relationships", "parenting-techniques", "aftercare-programs", "weekend-activities"]);

const seedCategories = db.transaction(() => {
  let sortOrder = 0;
  for (let i = 0; i < overviewRows.length; i++) {
    const row = overviewRows[i];
    const verticalName = row["Vertical"] || "";
    const cleanName = verticalName.replace(/^\d+\.\s*/, "");
    const slug = toSlug(cleanName);
    if (REMOVED_SLUGS.has(slug)) {
      console.log(`Skipped removed category: ${cleanName}`);
      continue;
    }
    sortOrder++;
    const result = insertCategory.run(
      cleanName, slug,
      row["Description"] || "",
      row["Target Age Groups"] || "",
      row["Key Focus Areas"] || "",
      String(row["# of Resources Listed"] || "0"),
      sortOrder
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
      row["Mandarin Study Options"] || "",
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

// Seed Summer Camps
const SUMMER_CAMPS = [
  // Nature & Outdoor
  { name: "Sea & Sage Audubon Nature Camp", type: "Nature / Outdoor", ageGroup: "4-12 years", description: "Nature camps at San Joaquin Wildlife Sanctuary. Campers explore ponds, wetlands, and wildlife with a 1:4 camper-to-naturalist ratio.", keyTopics: "Nature walks, wildlife observation, nature journaling, art projects, guest speakers", schedule: "Mon-Fri 8:30 AM - 12:30 PM", cost: "Contact for pricing", website: "https://seaandsageaudubon.org/", location: "San Joaquin Wildlife Sanctuary, Irvine, CA", subcategory: "Nature & Outdoor" },
  { name: "Farm School OC at Tanaka Farms", type: "Nature / Farm", ageGroup: "3.5-7 years", description: "Immersive farm-life experience with hands-on agricultural activities, animal care, and nature exploration at Tanaka Farms.", keyTopics: "Farm animals, agriculture, arts & crafts, nature exploration, food education", schedule: "Mon-Fri 10:30 AM - 1:30 PM", cost: "Contact for pricing", website: "https://www.farmschooloc.com/", location: "Tanaka Farms, Irvine, CA", subcategory: "Nature & Outdoor" },
  { name: "Irvine Ranch Outdoor Education Center", type: "Outdoor Adventure", ageGroup: "6-17 years", description: "ACA-accredited outdoor day camps with nature exploration, team building, and adventure activities. Daily meals provided.", keyTopics: "Nature hikes, team building, STEM, zip line, rock wall, archery, swimming", schedule: "Mon-Fri 8:00 AM - 4:00 PM (half-day available)", cost: "Contact for pricing", website: "https://www.outdooreducationcenter.org/", location: "2 Irvine Park Rd, Orange, CA", subcategory: "Nature & Outdoor" },

  // STEM / STEAM
  { name: "BioNerds STEAM Summer Camp", type: "STEAM", ageGroup: "Kindergarten - 6th grade", description: "Weekly STEAM-focused camp sessions with hands-on, science-based activities. Different themed weeks including robotics, dinosaurs, and marine biology.", keyTopics: "Robotics, dinosaurs, marine biology, insects, STEAM experiments", schedule: "Half-day 9 AM-12 PM or 1-4 PM; Full-day 9 AM-4 PM", cost: "Contact for pricing", website: "https://www.bionerdsllc.com/", location: "255 Visions, Irvine, CA 92618", subcategory: "STEM / STEAM" },
  { name: "BrainStorm STEM Education", type: "STEM", ageGroup: "Grades K-8", description: "Hands-on STEM activities that spark curiosity and creativity, creating the next generation of innovators.", keyTopics: "Robotics, LEGO engineering, coding, science experiments, engineering challenges", schedule: "Summer sessions (contact for dates)", cost: "Virtual from $179; in-person contact", website: "https://brainstormedu.com/", location: "42 Waterworks Way, Irvine, CA 92618", subcategory: "STEM / STEAM" },
  { name: "Rolling Robots", type: "Robotics / Coding", ageGroup: "5-15 years", description: "Project-based robotics and coding camps where children build robots, learn to code, and develop technical skills.", keyTopics: "LEGO & VEX robotics, Scratch & Python, BattleBots, Minecraft coding, 3D printing", schedule: "June 1 - Aug 14; half-day and full-day", cost: "Contact for pricing", website: "https://www.rollingrobots.com/", location: "820 Roosevelt Ave Ste 200, Irvine, CA 92620", subcategory: "STEM / STEAM" },
  { name: "Snapology of Irvine", type: "STEAM / LEGO", ageGroup: "4 years - high school", description: "Uses LEGO bricks and technology to make learning fun — coding, robotics, science, and arts through themed sessions.", keyTopics: "LEGO building, coding, robotics, science & arts, STEAM exploration", schedule: "Weekly summer camps (2026 dates TBA)", cost: "Contact for pricing", website: "https://www.snapology.com/california-irvine/", location: "Irvine, CA", subcategory: "STEM / STEAM" },
  { name: "PlanetBravo STEM Camp", type: "STEM / Technology", ageGroup: "Grades K-9", description: "Technology-focused summer camps combining coding, engineering, multimedia arts, and game design.", keyTopics: "Coding, video game design, Minecraft modding, animation, video production, robotics", schedule: "Mon-Fri 9:00 AM - 3:00 PM; aftercare until 5:30 PM", cost: "Early bird $349/week; standard $399-$599/week", website: "https://www.planetbravo.com/camps/irvine.php", location: "Irvine, CA", subcategory: "STEM / STEAM" },
  { name: "CodeREV Kids", type: "Coding / Technology", ageGroup: "Elementary and up", description: "Tech camps with hands-on STEM education including Minecraft engineering, game development, and coding.", keyTopics: "Minecraft engineering, Unity 3D, MathCraft, coding, game design", schedule: "Week-long half/full day camps", cost: "Affordable (contact for pricing)", website: "https://www.coderevkids.com/", location: "Irvine / Newport area", subcategory: "STEM / STEAM" },

  // Arts & Creative
  { name: "Aspire Art Studios", type: "Visual Arts", ageGroup: "Young children - teens", description: "Highly rated art studio summer camps designed to spark imagination and nurture creativity. 7:1 student-to-teacher ratio.", keyTopics: "Drawing, painting, mixed media, creative expression, individual art guidance", schedule: "Morning, afternoon, and full-day sessions", cost: "10% early bird by Feb 28; contact for pricing", website: "https://www.aspireartstudios.com/", location: "6829 Quail Hill Pkwy, Irvine, CA", subcategory: "Arts & Creative" },

  // Mandarin / Language
  { name: "A Little Dynasty Summer Camp", type: "Mandarin Immersion", ageGroup: "15 months - elementary", description: "Full-day Mandarin immersion summer camp combining academics with science, sports, discovery, and Chinese culture.", keyTopics: "Mandarin immersion, Night Market, Crayonology, robotics, outdoor games, cultural activities", schedule: "Full day (contact for dates)", cost: "Contact for pricing", website: "https://www.alittledynasty.com/", location: "17072 Gillette Ave, Irvine, CA 92614", subcategory: "Language Immersion" },
  { name: "SCCCA Summer Camp", type: "Mandarin / Cultural", ageGroup: "PreK - 6th grade", description: "Multiple summer camp options including PreK program, Chinese Cultural Camp, Activity Camp, and Mandarin Conversation Camp.", keyTopics: "Mandarin conversation, Chinese culture, PreK activities, academic enrichment", schedule: "PreK: 8:45 AM-4 PM; extended care 8 AM-5:30 PM", cost: "Contact for pricing", website: "https://www.sccca.org/", location: "Irvine, CA", subcategory: "Language Immersion" },

  // General / Multi-Activity
  { name: "City of Irvine Summer Camps", type: "General / Multi-Activity", ageGroup: "Varies by program", description: "Wide variety of affordable municipal summer camps across multiple categories — arts, sports, cooking, drama, education.", keyTopics: "Cooking, crafts, dance, music, drama, education, sports", schedule: "Summer sessions at various community centers", cost: "Affordable municipal pricing", website: "https://www.yourirvine.org/", location: "Various Irvine community centers", subcategory: "General & Multi-Activity" },
  { name: "Camp Galileo", type: "Innovation / Creative", ageGroup: "Rising K - 10th grade", description: "Well-known innovation camp fostering creativity, problem-solving, and confidence. Nebulas group for K-1st has higher staff ratio.", keyTopics: "Innovation challenges, design projects, art, outdoor play, science, team building", schedule: "Mon-Fri 9 AM-3 PM; extended care 8 AM-6 PM", cost: "$50/wk early bird discount; extended care $36-$90/wk", website: "https://galileo-camps.com/", location: "Multiple Irvine locations", subcategory: "General & Multi-Activity" },
  { name: "So Fly Kids at Great Park", type: "STEAM / Multi-Activity", ageGroup: "Contact for ages", description: "Great Park Irvine's #1 Kids Camp combining STEAM-based learning with outdoor activities at Beacon Park.", keyTopics: "Art, science, dance, sports, gymnastics, cooking, team building", schedule: "Weekly summer sessions", cost: "Contact for pricing", website: "https://www.soflykids.com/great-park-summer-camp", location: "Beacon Park, Great Park, Irvine, CA", subcategory: "General & Multi-Activity" },
  { name: "Camp Izza", type: "General Day Camp", ageGroup: "5-12 years", description: "One of Irvine's most popular summer day camps since 2008. ACA (American Camp Association) accredited.", keyTopics: "Outdoor activities, social & recreational play, themed weekly activities", schedule: "June 22 - July 31, 2026; full-day sessions", cost: "Contact for pricing", website: "https://campizza.com/", location: "New Horizon School, Irvine, CA", subcategory: "General & Multi-Activity" },
  { name: "Merage JCC Camp Yeladim", type: "Community / Preschool Camp", ageGroup: "Ages 2+", description: "Preschool camp at Merage JCC with credentialed Early Childhood Educators. Scholarships available. Open to all families.", keyTopics: "Age-appropriate play, arts & crafts, outdoor play, social skills, swimming", schedule: "Sessions June-August 2026", cost: "Scholarships available; contact for pricing", website: "https://www.jccoc.org/pages/camp/", location: "Merage JCC, Irvine, CA", subcategory: "General & Multi-Activity" },

  // Sports & Gymnastics
  { name: "The Little Gym of Irvine", type: "Gymnastics", ageGroup: "3-10 years", description: "Indoor gymnastics-based camps. Super Quest Camps for ages 3-8 with adventure-themed programming and small class sizes.", keyTopics: "Gymnastics, adventure themes, coordination, team games, creative movement", schedule: "3-4 hour sessions", cost: "Contact for pricing", website: "https://www.thelittlegym.com/california-irvine/", location: "Irvine, CA", subcategory: "Sports & Gymnastics" },
  { name: "Ultimate Kids", type: "Gymnastics / Fitness", ageGroup: "Preschool - elementary", description: "Structured gymnastics and fitness camps with organized instructional learning. Low 1:8 ratio for preschool camps.", keyTopics: "Gymnastics, fitness, structured play, skill development", schedule: "Preschool: 8 AM-1 PM or 8:30 AM-11:30 AM", cost: "$10 enrollment fee; contact for session pricing", website: "https://ultimate-kids.com/", location: "Irvine, CA", subcategory: "Sports & Gymnastics" },

  // Music
  { name: "Irvine School of Music Summer Camp", type: "Music / Performing Arts", ageGroup: "2-12 years", description: "Summer camps with hands-on instrument experiences, songwriting, and music production. Each week ends with a performance.", keyTopics: "Instrument exploration, songwriting, music production, weekly performances", schedule: "Weekly sessions with performances", cost: "Contact for pricing", website: "https://www.irvineschoolofmusic.com/summer-camp/", location: "Irvine, CA", subcategory: "Arts & Creative" },

  // Preschool-Based
  { name: "Kiddie Academy CampVentures", type: "Early Childhood", ageGroup: "Ages 2 - elementary", description: "Action-packed summer-themed learning for children from age 2. Extended hours (6:30 AM-6:30 PM) ideal for working parents. Meals included.", keyTopics: "Developmental activities, educational enrichment, outdoor play, included meals", schedule: "6:30 AM - 6:30 PM", cost: "Meals included; contact for pricing", website: "https://kiddieacademy.com/academies/irvine/programs/summer-camp/", location: "Irvine, CA", subcategory: "Early Childhood" },
  { name: "Turtle Rock Summer Camp", type: "General / Early Childhood", ageGroup: "Kindergarten - 3rd grade", description: "Established in 1981, one of Irvine's most well-known early childhood programs. Themed weeks with flexible enrollment.", keyTopics: "Themed weekly programming, field trips, playground activities, creative arts", schedule: "Core: 8:30 AM-4 PM; Extended: 7:30 AM-5:30 PM", cost: "Contact for pricing", website: "https://turtlerocksummer.com/", location: "1 Concordia, Irvine, CA", subcategory: "Early Childhood" },
  { name: "Pretend City Children's Museum", type: "Museum / Play-Based", ageGroup: "Infant - 8 years", description: "Beloved children's museum with interactive themed areas and summer programming including Kidstock Music & Arts Festival.", keyTopics: "Interactive play, Kidstock festival, live performances, instrument exploration", schedule: "Museum hours; contact for summer programs", cost: "Included with admission; camps extra", website: "https://www.pretendcity.org/", location: "29 Hubble, Irvine, CA 92618", subcategory: "Early Childhood" },

  // Academic
  { name: "IPSF Summer Programs", type: "Academic Enrichment", ageGroup: "PreK (TK) - 12th grade", description: "Irvine Public Schools Foundation summer academic enrichment utilizing IUSD school facilities. Registration deadline April 30, 2026.", keyTopics: "Academic enrichment, skill building, PreK/TK readiness, subject-focused classes", schedule: "Summer sessions at IUSD schools", cost: "Fee-based; contact for pricing", website: "https://ipsf.net/classes-and-camps/summer-programs/", location: "Various IUSD school sites, Irvine", subcategory: "Academic" },
];

const seedSummerCamps = db.transaction(() => {
  const campResult = insertCategory.run(
    "Summer Camps",
    "summer-camps",
    "Top-rated summer camps in Irvine for kids ages 0-7 — STEM, nature, arts, sports, language immersion, and more.",
    "0-12 years",
    "STEM, Nature, Arts, Sports, Mandarin, Music, Gymnastics, Academic",
    String(SUMMER_CAMPS.length),
    10 // sort_order after preschools
  );
  const campCategoryId = campResult.lastInsertRowid;
  console.log(`Created category: Summer Camps (id=${campCategoryId})`);

  // Create subcategories
  const subcats = [...new Set(SUMMER_CAMPS.map(c => c.subcategory))];
  const subcatMap = {};
  let subOrder = 0;
  for (const sub of subcats) {
    subOrder++;
    const result = insertSubcategory.run(sub, toSlug(sub), subOrder, campCategoryId);
    subcatMap[sub] = result.lastInsertRowid;
    console.log(`  Subcategory: ${sub}`);
  }

  let resourceOrder = 0;
  for (const camp of SUMMER_CAMPS) {
    resourceOrder++;
    let slug = toSlug(camp.name);
    while (globalUsedSlugs.has(slug)) {
      slug = `${toSlug(camp.name)}-camp-${resourceOrder}`;
    }
    globalUsedSlugs.add(slug);

    insertResource.run(
      camp.name, slug, camp.type, camp.ageGroup,
      camp.description, camp.keyTopics, camp.schedule || null, camp.cost,
      camp.website || null, camp.location || null,
      campCategoryId, subcatMap[camp.subcategory] || null, resourceOrder
    );
    console.log(`    Resource: ${camp.name}`);
  }
});
seedSummerCamps();

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

// Switch from WAL to delete journal mode for read-only deployment (e.g., Vercel)
db.pragma("journal_mode = DELETE");
console.log("Switched journal mode to DELETE for read-only deployment.");

db.close();
