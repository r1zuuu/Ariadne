import { defineConfig } from "drizzle-kit";

// Single .env lives at the repo root, shared with docker-compose.
process.loadEnvFile("../.env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
