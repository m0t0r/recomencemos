/**
 * **Who, other than her, may see a CapabilityProfile** — written once.
 *
 * Story 25 made "visible" two conditions rather than one: `state` is
 * moderation's and `paused_at` is hers (DD8), and a profile is on the site
 * exactly when it is published **and** she has not paused it. Before the Pause
 * there were four `state = 'published'` literals in this package, one per read;
 * a fifth read carrying only half of the predicate would be a paused profile
 * served to a stranger, with nothing red anywhere. So every read that serves
 * somebody who is not her takes this — the Wall, the browsable list, both
 * halves of the gated read, and the send — and her own read takes neither half.
 *
 * **`'published'` is a literal in the SQL rather than a bound parameter**, and
 * that is for the four partial indexes rather than for style. Each is `WHERE
 * state = 'published'`, and the planner uses a partial index only when it can
 * prove the query's predicate implies the index's — which it can against a
 * literal in every plan, and against a parameter only in a custom one.
 *
 * **Why the indexes are not narrowed to `AND paused_at IS NULL` as well** is on
 * each index in `#schema`: this predicate still implies theirs, so they still
 * serve it, and the rows the extra condition drops are a small reversible
 * fraction the index scan filters in passing.
 */

import { type SQL, sql } from "drizzle-orm";
import * as schema from "#schema";

export const visibleToOthers: SQL = sql`(${schema.capabilityProfile.state} = 'published' and ${schema.capabilityProfile.pausedAt} is null)`;
