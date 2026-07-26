// Mints an MCP token from the command line. The app does the same thing through
// POST /tokens; this stays for when there is no app running yet.
// Run from backend/: npx tsx scripts/mint-token.ts <email> [label]
process.loadEnvFile("../.env");

const [email, label = "local dev"] = process.argv.slice(2);
if (!email) {
  console.error("usage: npx tsx scripts/mint-token.ts <email> [label]");
  process.exit(1);
}

const { db } = await import("../src/db/client.js");
const { users } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const { createApiToken } = await import("../src/service.js");

const [user] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email.trim().toLowerCase()));
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}

const { token } = await createApiToken({ userId: user.id, label });

console.log(`user_id: ${user.id}`);
console.log(`token (shown once, the DB only keeps its hash):\n${token}`);
process.exit(0);
