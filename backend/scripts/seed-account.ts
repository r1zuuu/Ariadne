// Creates the real account and its first project card by hand; the app gets a
// registration form and a project form in step 5b. Re-runnable: refreshes the
// profile and the card, leaves existing nodes untouched.
// Run from backend/: npx tsx scripts/seed-account.ts [password]
//
// Pass a password to make the account usable through POST /auth/login. Without
// one, a fresh row gets a placeholder hash that no password can match.
process.loadEnvFile("../.env");

const EMAIL = "stanislaw@rayzacher.pl";
const PASSWORD = process.argv[2];

const PROFILE = [
  "Stas (Stanislaw Rayzacher), junior frontend developer, uczy sie budujac.",
  "Chce rozumiec dlaczego cos robimy tak, nie tylko co - tlumacz decyzje, nie tylko kod.",
  "Nie znosi over-engineeringu: najprostsze rozwiazanie, ktore dziala, wygrywa.",
  "Zna Next.js, React, TypeScript, Tailwind, React Native.",
  "Rozmowa po polsku, kod i komentarze po angielsku.",
].join(" ");

// Card of the project we hook up first (plan step 4).
const PROJECT = {
  name: "Portfolio",
  repoRef: "https://github.com/r1zuuu/portfolio.git",
  opis: "Osobista strona portfolio: pokazuje projekty i umiejetnosci przy szukaniu pierwszej pracy we frontendzie.",
  stack: "Next.js App Router, React, TypeScript, Tailwind, next-intl (EN/PL), Framer Motion, three.js, deploy na Vercel",
  dlaKogo: "dla siebie",
  grupaOdbiorcza: "rekruterzy i pracodawcy przegladajacy portfolio juniora",
  konwencjeRef: "CLAUDE.md",
  ograniczenia:
    "Zero backendu i bazy, strona jest statyczna. Teksty tylko przez i18n/en.json i i18n/pl.json, nigdy na sztywno w komponencie. Kazda strona ma generateStaticParams dla obu jezykow.",
  etap: "produkcja",
};

const { db } = await import("../src/db/client.js");
const { projects, users } = await import("../src/db/schema.js");
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

const card = { ...PROJECT, userId: user.id, repoRef: normalizeRepoRef(PROJECT.repoRef) };
const [project] = await db
  .insert(projects)
  .values(card)
  .onConflictDoUpdate({
    target: [projects.userId, projects.repoRef],
    set: { ...card, updatedAt: new Date() },
  })
  .returning({ id: projects.id });

console.log(`user_id:    ${user.id}  (${EMAIL})`);
console.log(`project_id: ${project.id}  (repo_ref: ${card.repoRef})`);
console.log(`password:   ${passwordHash ? "set" : "not set, pass one as argv to enable login"}`);
console.log(`next: npx tsx scripts/mint-token.ts ${EMAIL} "claude code"`);
process.exit(0);
