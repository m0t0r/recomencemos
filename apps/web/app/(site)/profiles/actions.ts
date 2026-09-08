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

import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { browseFiltersFrom, FILTER_KEYS } from "./_lib/filters";

/**
 * **The filters travel with the cursor, and they have to.** A cursor names a
 * row's position in an ordering, and an ordering over a different population is
 * a different ordering — so a page two that dropped its filters would not merely
 * show the wrong rows, it would skip and repeat rows within the set it did show.
 *
 * **The three filter terms arrive in their URL spelling and are read by
 * `browseFiltersFrom`, the same function the page reads them with.** This
 * schema deliberately says almost nothing about them: it is a directly reachable
 * POST endpoint, so what arrives is a string or it is not, and every decision
 * about what a *filter* is — the trim, the length bound, which city ids exist,
 * what a Skill slug looks like — belongs to the one function that already makes
 * it. Restating those rules here is what produced a first draft where the action
 * did not trim and the page did.
 *
 * The cursor is this schema's own, because it is not a filter: it is checked
 * against the slug minter's pattern, which `@repo/domain/profiles` owns.
 */
const nextPageSchema = z.object({
  /** The opaque public handle of the last row on the page already shown. */
  after: z.string().regex(SLUG_PATTERN),
  [FILTER_KEYS.query]: z.string().optional(),
  [FILTER_KEYS.skill]: z.string().optional(),
  [FILTER_KEYS.city]: z.string().optional(),
});

export const loadMoreProfiles = actionClient
  .inputSchema(nextPageSchema)
  .action(async ({ parsedInput: { after, ...params } }) => {
    const page = await profiles.browse({ ...browseFiltersFrom(params), after });

    return { profiles: page.items, nextCursor: page.nextCursor };
  });
