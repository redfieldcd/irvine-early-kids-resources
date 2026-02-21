#!/usr/bin/env node
/**
 * IKR — AI-native CLI for Irvine Kids Resources
 *
 * Usage:
 *   node cli/ikr.mjs                        # Interactive chat mode
 *   node cli/ikr.mjs "how many visitors?"   # Single question mode
 *
 * Requires: ANTHROPIC_API_KEY, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN in .env.local
 */
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { toolDefinitions, toolHandlers } from "./tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Load .env.local
const envPath = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("\x1b[31m✗ ANTHROPIC_API_KEY not set.\x1b[0m");
  console.error("  Add it to .env.local or export it:");
  console.error("  export ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}

const client = new Anthropic();

const SYSTEM_PROMPT = `You are IKR, the AI assistant for the "Irvine Kids Resources" website (irvine-kids-resources.biphoenixtrees.com).

You help the site admin manage resources, view analytics, and operate the site. You have access to tools for:
- **Resource management**: list, search, add, update, remove preschools and mandarin study resources
- **Analytics**: view page views, visitors, clicks, popular pages, popular resources, daily trends
- **Comments**: view recent user comments
- **Site operations**: deploy to Vercel, backup database, check for broken links, run shell commands

The site currently has 2 categories: Mandarin Study and Preschools.
Data architecture: Static content in SQLite (bundled), user-generated data in Turso (cloud).
Site URL: https://irvine-kids-resources.biphoenixtrees.com

Be concise and helpful. When showing data, format it nicely. Use tools proactively — don't ask for permission, just do it.
When the user asks to add or change resources, do it immediately. Remind them to deploy after database changes.`;

// Colors
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function printBanner() {
  console.log();
  console.log(`${C.cyan}${C.bold}  🌱 IKR — Irvine Kids Resources CLI${C.reset}`);
  console.log(`${C.gray}  AI-powered site management. Type "exit" to quit.${C.reset}`);
  console.log(`${C.gray}  ─────────────────────────────────────────────────${C.reset}`);
  console.log();
}

async function chat(messages) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: toolDefinitions,
    messages,
  });

  return response;
}

async function processResponse(response, messages) {
  // Collect all content blocks
  let textOutput = "";
  let hasToolUse = false;
  const toolResults = [];

  for (const block of response.content) {
    if (block.type === "text") {
      textOutput += block.text;
    } else if (block.type === "tool_use") {
      hasToolUse = true;
      const toolName = block.name;
      const toolInput = block.input;

      console.log(`${C.dim}  ⚡ ${toolName}${toolInput.command ? `: ${toolInput.command}` : ""}${C.reset}`);

      // Execute the tool
      const handler = toolHandlers[toolName];
      let result;
      if (handler) {
        try {
          result = await handler(toolInput);
        } catch (e) {
          result = `Error: ${e.message}`;
        }
      } else {
        result = `Error: Unknown tool "${toolName}"`;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: String(result),
      });
    }
  }

  if (textOutput) {
    console.log();
    console.log(`${C.green}${textOutput}${C.reset}`);
  }

  // If there were tool uses, send results back to Claude for the next response
  if (hasToolUse) {
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    const nextResponse = await chat(messages);
    return processResponse(nextResponse, messages);
  }

  return messages;
}

async function handleUserInput(input, messages) {
  messages.push({ role: "user", content: input });

  try {
    const response = await chat(messages);
    messages = await processResponse(response, messages);
  } catch (e) {
    console.error(`${C.yellow}Error: ${e.message}${C.reset}`);
  }

  return messages;
}

async function main() {
  const singleQuery = process.argv.slice(2).join(" ").trim();

  if (singleQuery) {
    // Single-shot mode
    let messages = [];
    await handleUserInput(singleQuery, messages);
    process.exit(0);
  }

  // Interactive mode
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.cyan}ikr>${C.reset} `,
  });

  let messages = [];

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input === "exit" || input === "quit" || input === "q") {
      console.log(`\n${C.dim}  Bye! 👋${C.reset}\n`);
      process.exit(0);
    }
    if (input === "clear") {
      messages = [];
      console.log(`${C.dim}  Conversation cleared.${C.reset}`);
      rl.prompt();
      return;
    }

    messages = await handleUserInput(input, messages);
    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\n${C.dim}  Bye! 👋${C.reset}\n`);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
