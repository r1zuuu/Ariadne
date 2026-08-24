-- The lexical half of search (plan section 7, revised).
--
-- Embeddings understand meaning, and a proper name has none - it has identity.
-- "What did we settle on for normalizeRepoRef" lands as close to a note about
-- tidying repository URLs that never says the name as to the one that does,
-- because both are about the same thing. Ariadne is a memory about code, so
-- questions naming a function, a path, a library or a commit are the everyday
-- case rather than the edge one, and the miss is silent: no error, just a
-- confident answer built from five entries that were not the right five.
--
-- So: a second, dumber index that only knows literal words, queried beside the
-- vector one and merged by rank. This migration is the storage half of it.

-- 'simple', not 'english' and not 'polish'. No stemming, no stopwords.
--
-- The archive is written in two languages - a person writing Polish and a coder
-- writing English land in the same table - so any one language's dictionary is
-- wrong for half the rows. Polish would also need an ispell dictionary
-- installed, which is not ours to install on a managed instance.
--
-- More to the point, nothing but proper names is ever sent to this index, and
-- stemming a proper name is at best useless and at worst destructive.
--
-- The two-argument form is required, not stylistic: to_tsvector(text) reads
-- default_text_search_config from the session and is therefore not IMMUTABLE,
-- which a generated column refuses.
--
-- content only, no summary: the summary is written from the content, so its
-- words are already here.
ALTER TABLE "nodes" ADD COLUMN "search_text" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;
--> statement-breakpoint

CREATE INDEX "nodes_search_gin" ON "nodes" USING gin ("search_text");
--> statement-breakpoint

-- Neither the column nor the index appears in schema.ts: Drizzle has no tsvector
-- type and adding a customType for one column would be this repo's first. The
-- one query that reads it does so through a raw sql fragment. drizzle-kit does
-- not introspect a live database when generating, so a column it has never
-- heard of is never proposed for dropping - the same standing as the policies
-- in migration 0008.
--
-- No policy work needed either. nodes_tenant names only workspace_id, and the
-- grants from 0008 are table-level, so a new column arrives already covered.
COMMENT ON COLUMN "nodes"."search_text" IS
  'Lexical half of hybrid search: literal words of content, simple config. Read by searchNodes through a raw sql fragment; not declared in schema.ts.';
