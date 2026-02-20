import { createClient, type Client } from "@libsql/client/web";

let client: Client;

export function getTurso(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
      );
    }

    // Convert libsql:// to https:// for HTTP transport (required for Vercel serverless)
    const httpUrl = url.replace(/^libsql:\/\//, "https://");

    client = createClient({ url: httpUrl, authToken });
  }
  return client;
}

export default getTurso;
