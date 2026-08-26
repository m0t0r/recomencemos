-- Runs once, when the data directory is first created.
--
-- `citext` and `pg_trgm` are enabled out of band on both of the other two
-- engines this schema meets: a human turns them on in the PlanetScale console
-- (go-live runbook §2), and PGlite bundles them (spec 0002, Testing Decisions
-- seam 2). So they are enabled out of band here as well, rather than in a
-- migration — a `CREATE EXTENSION` in a committed migration would be a
-- statement that cannot run against the database it is written for.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
