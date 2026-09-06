import { defineConfig } from "drizzle-kit";

// The same configuration as drizzle.config.ts, pointed at the container from
// docker-compose.yml instead of the real database.
//
// It exists because the ordinary config hardcodes `process.loadEnvFile("../.env")`,
// and that file holds the production connection string. `loadEnvFile` does not
// overwrite a variable the environment already carries, so exporting DATABASE_URL
// in the shell would also work - but it works silently, and a migration run
// against the wrong database is not a mistake that announces itself. A second
// config with "test" in its name cannot be run by accident.
//
//   npx drizzle-kit migrate --config drizzle.config.test.ts
process.loadEnvFile("../.env.test");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
