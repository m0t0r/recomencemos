"use server";

/**
 * The next page of the browsable list, for a reader who is scrolling rather than
 * navigating.
 *
 * **This is new public surface, and it is worth knowing that.** The API
 * contract's `### Public — no Account` table lists `GET /profiles` as a Server
 * Component and nothing beside it; infinite scroll needs a page-two the browser
 * can ask for without a navigation, so this is the smallest thing that can be.
 * It returns exactly what the page already renders — `PublicProfile[]`, through
 * the same domain read and the same projection — so it discloses nothing the
 * route did not already serve to anyone.
 *
 * **What it does add is a cheaper way to take all of it**, and NFR26 bounds no
 * public list read: its ceilings are on gated profile reads and on the
 * state-changing actions. The public projection is indexable by design, so what
 * is at stake is convenience rather than confidentiality — but a bound on this
 * is a real question for the spec, and it is flagged rather than invented here.
 *
 * **It authorizes nothing, deliberately, and that is the one thing to check
 * before copying this file.** Every other action in this app has a principal;
 * this one is the public list, which the whole of story 4 exists to serve
 * without an account. The boundary parse is still the boundary parse.
 */

import { type CityId, isCityId } from "@repo/domain/policy";
import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { MAX_QUERY_LENGTH, SKILL_SLUG } from "./_lib/filters";

/**
 * **The filters travel with the cursor, and they have to.** A cursor names a
 * row's position in an ordering, and an ordering over a different population is
 * a different ordering — so a page two that dropped its filters would not merely
 * show the wrong rows, it would skip and repeat rows within the set it did show.
 *
 * They are parsed here rather than trusted: this is a directly reachable POST
 * endpoint and the boundary parse is the boundary parse, whatever the component
 * that calls it happens to send. The shapes are the ones `_lib/filters` accepts
 * from the URL, which is what keeps the two doors into this read agreeing about
 * what a filter is.
 */
const nextPageSchema = z.object({
  /** The opaque public handle of the last row on the page already shown. */
  after: z.string().regex(SLUG_PATTERN),
  query: z.string().max(MAX_QUERY_LENGTH).default(""),
  skill: z.string().regex(SKILL_SLUG).nullable().default(null),
  // The registry's own guard rather than a second list of three municipalities:
  // `CITIES` is what the `CHECK` constraint is generated from, and a copy here
  // would be the thing that goes stale when a fourth one is added.
  city: z
    .custom<CityId>((value) => typeof value === "string" && isCityId(value))
    .nullable()
    .default(null),
});

export const loadMoreProfiles = actionClient
  .inputSchema(nextPageSchema)
  .action(async ({ parsedInput }) => {
    const page = await profiles.browse(parsedInput);

    return { profiles: page.items, nextCursor: page.nextCursor };
  });
