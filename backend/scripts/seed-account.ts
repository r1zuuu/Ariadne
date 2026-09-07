// Creates an account and its first project card by hand; the app gets a
// registration form and a project form in step 5b. Re-runnable: refreshes the
// profile and the card, leaves existing nodes untouched.
// Run from backend/: npx tsx scripts/seed-account.ts <email> [password]
//
// Pass a password to make the account usable through POST /auth/login. Without
// one, a fresh row gets a placeholder hash that no password can match.
process.loadEnvFile("../.env");
// Admin script: runs as the owner role, which the policies of migration 0008 do
// not apply to. It writes an account's first rows, from outside any session.
process.env.DATABASE_URL_APP = process.env.DATABASE_URL;

const [EMAIL, PASSWORD] = process.argv.slice(2);
if (!EMAIL) {
  console.error("usage: npx tsx scripts/seed-account.ts <email> [password]");
  process.exit(1);
}

// Sample profile and card. Both are illustrations of what the archive holds:
// the profile is what every agent session opens with, the card is what
// get_project_context answers. Edit them to seed a real account.
const PROFILE = [
  "Frontend developer, learning by building.",
  "Wants to know why a thing is done this way, not only what was done: explain decisions, not just code.",
  "Dislikes over-engineering: the simplest solution that works wins.",
  "Knows Next.js, React, TypeScript, Tailwind.",
].join(" ");

const PROJECT = {
  name: "Portfolio",
  repoRef: "https://github.com/example/portfolio.git",
  opis: "Personal portfolio site: shows projects and skills while looking for a first frontend job.",
  stack: "Next.js App Router, React, TypeScript, Tailwind, next-intl (EN/PL), deployed on Vercel",
  dlaKogo: "for myself",
  grupaOdbiorcza: "recruiters and employers reading a junior portfolio",
  konwencjeRef: "CLAUDE.md",
  ograniczenia:
    "No backend and no database, the site is static. Copy lives only in i18n/en.json and i18n/pl.json, never hardcoded in a component. Every page has generateStaticParams for both languages.",
  etap: "production",
};

const { db } = await import("../src/db/client.js");
const { memberships, projects, users, workspaces } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const { normalizeRepoRef } = await import("../src/service.js");

const passwordHash = PASSWORD ? await (await import("@node-rs/argon2")).hash(PASSWORD) : null;

// The hash is only rewritten when a password was given, so a re-run without one
// cannot downgrade a real hash back to the placeholder.
const [user] = await db
  .insert(users)
  .values({ email: EMAIL, passwordHash: passwordHash ?? "no-password-set", profile: PROFILE })
  .onConflictDoUpdate({
    target: users.email,
    set: passwordHash ? { profile: PROFILE, passwordHash } : { profile: PROFILE },
  })
  .returning({ id: users.id });

// The row goes straight into the table rather than through registerUser, so the
// private workspace that registration would have made has to be made here too.
const [existing] = await db
  .select({ id: workspaces.id })
  .from(workspaces)
  .where(eq(workspaces.ownerId, user.id))
  .orderBy(workspaces.createdAt)
  .limit(1);

let workspaceId = existing?.id;
if (!workspaceId) {
  const [created] = await db
    .insert(workspaces)
    .values({ name: EMAIL, ownerId: user.id })
    .returning({ id: workspaces.id });
  workspaceId = created.id;
  await db
    .insert(memberships)
    .values({ workspaceId, userId: user.id, role: "owner" })
    .onConflictDoNothing();
}

const card = { ...PROJECT, workspaceId, repoRef: normalizeRepoRef(PROJECT.repoRef) };
const [project] = await db
  .insert(projects)
  .values(card)
  .onConflictDoUpdate({
    target: [projects.workspaceId, projects.repoRef],
    set: { ...card, updatedAt: new Date() },
  })
  .returning({ id: projects.id });

console.log(`user_id:    ${user.id}  (${EMAIL})`);
console.log(`workspace:  ${workspaceId}`);
console.log(`project_id: ${project.id}  (repo_ref: ${card.repoRef})`);
console.log(`password:   ${passwordHash ? "set" : "not set, pass one as argv to enable login"}`);
console.log(`next: npx tsx scripts/mint-token.ts ${EMAIL} "claude code"`);
process.exit(0);
