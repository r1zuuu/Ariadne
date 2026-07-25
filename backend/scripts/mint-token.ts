// Mints an MCP token by hand; the app gets a UI for this in step 5.
// Run from backend/: npx tsx scripts/mint-token.ts <email> [label]
process.loadEnvFile("../.env");

const [email, label = "local dev"] = process.argv.slice(2);
if (!email) {
  console.error("usage: npx tsx scripts/mint-token.ts <email> [label]");
  process.exit(1);
}

const { db } = await import("../src/db/client.js");
const { apiTokens, users } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const { generateToken, hashToken } = await import("../src/service.js");

const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
if (!user) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}

const token = generateToken();
await db.insert(apiTokens).values({ userId: user.id, tokenHash: hashToken(token), label });

console.log(`user_id: ${user.id}`);
console.log(`token (shown once, the DB only keeps its hash):\n${token}`);
process.exit(0);
