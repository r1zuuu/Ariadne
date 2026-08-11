import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// Entry points (scripts, server) must load ../.env before first query.
//
// Two URLs, two roles (migration 0008). This one is the unprivileged role that
// every row-level policy applies to; DATABASE_URL still points at the owner and
// belongs to drizzle-kit and to the admin scripts, which are meant to see
// everything. No fallback between them: an app that quietly reconnects as the
// owner when a variable is missing is an app with no isolation and no symptom.
const url = process.env.DATABASE_URL_APP;
if (!url) {
  throw new Error(
    "DATABASE_URL_APP is not set. It is the ariadne_app role, the one row-level security applies to. See setup.md, or set it to DATABASE_URL in an admin script that is meant to bypass policies.",
  );
}

const pool = new pg.Pool({ connectionString: url });
const root = drizzle(pool, { schema });

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const scoped = new AsyncLocalStorage<Tx>();

/**
 * The handle every query in service.ts already uses. Inside asUser it resolves
 * to that request's transaction, so the ~60 call sites did not have to learn to
 * pass one around; outside, it is the plain pool and the policies see no
 * identity, which they read as "no rows".
 */
export const db = new Proxy(root, {
  get(target, prop) {
    const active = scoped.getStore() ?? target;
    const value = Reflect.get(active, prop, active);
    return typeof value === "function" ? value.bind(active) : value;
  },
});

/**
 * Runs everything inside as one person, in one transaction, with app.user_id set
 * for the policies to read. Wrapped around a whole request rather than around
 * each query, because the identity has to outlive any single statement for a
 * multi-step write to stay consistent.
 *
 * set_config's third argument is what makes it local: the setting dies with the
 * transaction, so a pooled connection never hands the last request's identity to
 * the next one.
 *
 * ponytail: a request that calls Gemini holds its transaction open for the round
 * trip, a few seconds of idle-in-transaction per write. Harmless at one process
 * and a handful of people; the day that shows up in pg_stat_activity, move the
 * model calls out of the wrapper rather than widening it.
 */
export function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  return root.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return scoped.run(tx, run);
  });
}
