import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import https from "https";
import http from "http";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "data", "database.db");
const imgDir = path.resolve(__dirname, "..", "public", "images", "resources");

// Ensure output directory exists
fs.mkdirSync(imgDir, { recursive: true });

const db = new Database(dbPath);

const resources = db
  .prepare("SELECT id, slug, name, website FROM resources WHERE website IS NOT NULL AND website != ''")
  .all()
  .filter((r) => {
    // Filter out non-URL values like "(contact directly)"
    const w = r.website.trim();
    return w && !w.startsWith("(") && w.includes(".");
  })
  .map((r) => {
    // Normalize URLs: prepend https:// if missing
    let url = r.website.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return { ...r, website: url };
  });

console.log(`Found ${resources.length} resources with websites.\n`);

const TIMEOUT = 15000;
const VIEWPORT = { width: 1280, height: 720 };

function fetchUrl(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: TIMEOUT, headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith("/")) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        resolve(fetchUrl(redirectUrl, redirectCount + 1));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ body: Buffer.concat(chunks), contentType: res.headers["content-type"] || "", statusCode: res.statusCode }));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
  });
}

function extractOgImage(html) {
  // Match og:image meta tag
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

async function downloadImage(imageUrl, outputPath) {
  const { body, contentType } = await fetchUrl(imageUrl);
  if (body.length < 1000) throw new Error("Image too small, likely invalid");
  fs.writeFileSync(outputPath, body);
  return true;
}

async function captureScreenshot(browser, url, outputPath) {
  const page = await browser.newPage();
  try {
    await page.setViewport(VIEWPORT);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    // Wait a bit for images/styles to load
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: outputPath, type: "jpeg", quality: 80 });
  } finally {
    await page.close();
  }
}

async function main() {
  // Dynamic import for puppeteer (ESM)
  const puppeteer = (await import("puppeteer")).default;

  let browser = null;
  const results = { ogImage: 0, screenshot: 0, failed: 0 };

  const updateImageUrl = db.prepare("UPDATE resources SET image_url = ? WHERE id = ?");

  for (let i = 0; i < resources.length; i++) {
    const { id, slug, name, website } = resources[i];
    const outputPath = path.join(imgDir, `${slug}.jpg`);
    const relativeUrl = `/images/resources/${slug}.jpg`;

    // Skip if image already exists
    if (fs.existsSync(outputPath)) {
      console.log(`[${i + 1}/${resources.length}] SKIP (exists): ${name}`);
      updateImageUrl.run(relativeUrl, id);
      continue;
    }

    console.log(`[${i + 1}/${resources.length}] Processing: ${name}`);
    console.log(`  URL: ${website}`);

    try {
      // Step 1: Try to fetch og:image
      let gotImage = false;
      try {
        const { body } = await fetchUrl(website);
        const html = body.toString("utf-8");
        const ogImageUrl = extractOgImage(html);

        if (ogImageUrl) {
          // Resolve relative og:image URLs
          let fullOgUrl = ogImageUrl;
          if (ogImageUrl.startsWith("/")) {
            const parsed = new URL(website);
            fullOgUrl = `${parsed.protocol}//${parsed.host}${ogImageUrl}`;
          } else if (!ogImageUrl.startsWith("http")) {
            fullOgUrl = new URL(ogImageUrl, website).href;
          }

          console.log(`  Found og:image: ${fullOgUrl}`);
          await downloadImage(fullOgUrl, outputPath);
          gotImage = true;
          results.ogImage++;
          console.log(`  -> Saved og:image`);
        }
      } catch (err) {
        console.log(`  OG fetch failed: ${err.message}`);
      }

      // Step 2: Fallback to screenshot
      if (!gotImage) {
        console.log(`  Taking screenshot...`);
        if (!browser) {
          browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          });
        }
        await captureScreenshot(browser, website, outputPath);
        results.screenshot++;
        console.log(`  -> Saved screenshot`);
      }

      updateImageUrl.run(relativeUrl, id);
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      results.failed++;
    }
  }

  if (browser) await browser.close();

  // Switch journal mode back for read-only deployment
  db.pragma("journal_mode = DELETE");
  db.close();

  console.log(`\nDone!`);
  console.log(`  OG images: ${results.ogImage}`);
  console.log(`  Screenshots: ${results.screenshot}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total images: ${results.ogImage + results.screenshot}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
