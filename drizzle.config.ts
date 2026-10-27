import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = (globalThis as typeof globalThis & {
  process: { env: Record<string, string | undefined> };
}).process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});