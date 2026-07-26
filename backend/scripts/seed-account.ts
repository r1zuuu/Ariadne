// Creates the real account and its first project card by hand; the app gets
// registration and a project form in step 5. Re-runnable: refreshes the profile
// and the card, leaves existing nodes untouched.
// Run from backend/: npx tsx scripts/seed-account.ts
process.loadEnvFile("../.env");

const EMAIL = "stanislaw@rayzacher.pl";

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

const [user] = await db
  .insert(users)
  // Password auth arrives with the REST layer in step 5; MCP authenticates by token.
  .values({ email: EMAIL, passwordHash: "set-in-step-5", profile: PROFILE })
  .onConflictDoUpdate({ target: users.email, set: { profile: PROFILE } })
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
console.log(`next: npx tsx scripts/mint-token.ts ${EMAIL} "claude code"`);
process.exit(0);
