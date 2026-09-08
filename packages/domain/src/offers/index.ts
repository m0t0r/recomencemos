/**
 * `@repo/domain/offers` — the Offer aggregate: sending one, listing the ones a
 * Hirer has sent, and the branch an Admin has to work through before any of them
 * reaches the person they are addressed to.
 *
 * **`sendOffer` is one transaction and the order inside it is the design**, not
 * an implementation detail (NFR15, DD9):
 *
 * 1. a **row lock** on the Hirer's Account;
 * 2. his `offerSendingState` **and** the Block edge, read beneath that lock;
 * 3. the contact-detail rejector on the three free-text fields (NFR12, DD3);
 * 4. the Offer;
 * 5. his self-asserted name and phone, **only on his first Offer** (C4);
 * 6. his *autorización*, through `recordConsent`, which takes the transaction
 *    and nothing else.
 *
 * **Why the lock is first.** Under `READ COMMITTED` an unlocked read of
 * `offer_sending_state` interleaves with the Report transaction that freezes it,
 * and an Offer gets through — and a Report plus a burst of Offers from the same
 * Hirer is the *expected* shape of the incident rather than an exotic one. NFR15
 * asks for zero further Offers from commit of the Report, and a lock taken after
 * the read would be a lock on a value already stale.
 *
 * **Why authorization is checked before validation.** A Blocked or frozen sender
 * meets his refusal rather than a note about a phone number in his text: the
 * more fundamental answer wins, which is the same order `adminActionClient` uses
 * when it refuses before the boundary parse.
 *
 * **Seam 2 cannot exercise the interleaving and it can exercise the
 * discipline.** PGlite is single-connection and in-process, so DD9's actual race
 * is out of reach — the spec says so in as many words. What
 * `offers.integration.test.ts` does instead is assert the two halves that are
 * observable: the state and the edge are read from the **row inside the
 * transaction** rather than from anything a caller read earlier, and the
 * `FOR UPDATE` is the **first** statement in that transaction.
 *
 * **Every refusal is returned, never thrown** (NFR26's second half, C51). A
 * contact detail in a field, a Block, a freeze, a slug naming nobody and an
 * Offer to one's own profile are all ordinary answers to an ordinary form, and a
 * crawler able to raise an `AppError` from any of them would spend the month's
 * Sentry allowance in a day. What throws is a database that will not answer, and
 * a stale consent version — which is genuinely unexpected and rolls the whole
 * collection back with it.
 *
 * **Immutability is the product, and it is enforced by absence.** There is no
 * function here that rewrites an Offer's terms, and no `CHECK` could add one:
 * `offers.integration.test.ts` asserts the absence rather than leaving it
 * implied.
 *
 * **Every function takes the handle first and the principal second**, the shape
 * `#database` fixes. The `offers` object at the foot binds the pooled connection
 * for `apps/web`, which ADR-0010 leaves with no handle of its own.
 */

import { and, count, eq, min, sql } from "drizzle-orm";
import { hasConsented, recordConsent } from "#consent/index";
import type { ConsentVersions } from "#consent/registry";
import type { DomainDatabase, DomainTransaction } from "#database";
import { asOfferSendingState, MOST_RESTRICTIVE_OFFER_SENDING_STATE } from "#policy/account-states";
import { type ContactDetailKind, rejectContactDetails } from "#policy/contact-details";
import { INITIAL_OFFER_STATE, PENDING_OFFER_STATES } from "#policy/offer-states";
import { normalizeColombianPhone } from "#policy/phone";
import { PUBLIC_COLUMNS, toPublic } from "#profiles/public-columns";
import { type SentOffer, toSentOffer } from "#projections";
import * as schema from "#schema";

/** The three fields he writes. Free text, all `personal`, all through the rejector. */
export interface OfferTerms {
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
}

/**
 * How a Hirer names himself. Collected **once**, on his first Offer, and stored
 * on the Account (C4) — never on the Offer, because a copy per Offer is a second
 * place for a correction to fail to reach.
 */
export interface HirerIdentity {
  readonly hirerName: string;
  readonly hirerPhone: string;
}

/**
 * What the boundary parse hands over. Shape has been checked; substance is
 * checked here.
 *
 * **`identity` is optional because the question "is this his first Offer" is
 * answered from a row rather than from anything a browser sends.** The surface
 * asks for a name and a number when he has never sent one, and this refuses the
 * send if it needed them and they did not arrive. Sending them on a later Offer
 * is not an error and is not a way to rewrite them: they are ignored, because
 * the name a Worker already read may not change under her.
 */
export interface SendOfferInput extends OfferTerms {
  readonly profileSlug: string;
  readonly identity?: HirerIdentity | undefined;
  readonly consentVersions: ConsentVersions;
}

/** The fields a refusal can name. English identifiers; the surface maps them to labels. */
export type OfferField = keyof OfferTerms | keyof HirerIdentity;

/**
 * One reason a send was refused, with what the surface needs to say it: the
 * field, the kind, and — for the rejector — the fragment NFR12 requires it to
 * quote back.
 */
export type OfferRefusal =
  | {
      readonly field: keyof OfferTerms;
      readonly code: "contact_detail";
      readonly kind: ContactDetailKind;
      readonly fragment: string;
    }
  | { readonly field: "hirerPhone"; readonly code: "phone_unrecognised" }
  | { readonly field: "hirerName"; readonly code: "identity_required" };

/**
 * What a send can answer.
 *
 * **`profile_not_found` covers a slug naming nobody and a profile that is not
 * published**, one answer for both, which is the shape `/profile/[slug]` already
 * takes: the page refuses a frozen caller with exactly the missing-profile
 * response, so a send that distinguished the two would reopen from the action
 * the oracle the page closed (C22).
 *
 * **`blocked` and `may_not_send` are distinct, and the surface is what decides
 * how plainly each is said.** They are different facts about different people —
 * one is her decision about him, the other is this platform's decision about him
 * — and collapsing them here would leave the surface unable to tell him what
 * changes and when.
 */
export type SendOfferOutcome =
  | { readonly ok: true; readonly offerId: string }
  | { readonly ok: false; readonly reason: "profile_not_found" }
  | { readonly ok: false; readonly reason: "own_profile" }
  | { readonly ok: false; readonly reason: "blocked" }
  | { readonly ok: false; readonly reason: "may_not_send"; readonly state: "frozen" | "banned" }
  | {
      readonly ok: false;
      readonly reason: "refused";
      readonly refusals: readonly OfferRefusal[];
    };

/**
 * The pure half: everything the three free-text fields can be refused for.
 *
 * The rejector is a speed bump and human review of every Offer is the control
 * (NFR12's second half) — so this names what it objected to and preserves
 * everything he typed, and no copy anywhere claims the field is a filter.
 */
function refusalsForTerms(terms: OfferTerms): OfferRefusal[] {
  const fields = ["workDescription", "payTerms", "whenText"] as const;
  const refusals: OfferRefusal[] = [];

  for (const field of fields) {
    const verdict = rejectContactDetails(terms[field]);
    if (verdict.ok) continue;

    refusals.push({
      field,
      code: "contact_detail",
      kind: verdict.kind,
      fragment: verdict.fragment,
    });
  }

  return refusals;
}

/**
 * The Hirer's own two fields, refused for the one thing that can be wrong with
 * them: a number this product cannot read back.
 *
 * **The name is not validated beyond being present**, deliberately. Nothing here
 * verifies anybody (ADR-0008), so a rule about what a name may look like would
 * be a check that refuses real people — *de la Cruz*, one word, four words — in
 * exchange for stopping nobody. The phone is different: it is a number a Worker
 * will dial, and one this product cannot normalise is one she cannot use.
 */
function refusalsForIdentity(identity: HirerIdentity): OfferRefusal[] {
  const refusals: OfferRefusal[] = [];

  if (identity.hirerName.trim().length === 0) {
    refusals.push({ field: "hirerName", code: "identity_required" });
  }

  if (!normalizeColombianPhone(identity.hirerPhone).ok) {
    refusals.push({ field: "hirerPhone", code: "phone_unrecognised" });
  }

  return refusals;
}

/**
 * **The lock, and the whole of NFR15's mechanism.**
 *
 * `SELECT … FOR UPDATE` on the Hirer's own `user` row, taken before anything
 * about him is read. A Report's freeze writes that same row, so the two
 * transactions serialise against each other rather than interleaving — which is
 * what makes "from commit of a Report, 0 further Offers" true rather than
 * probable.
 *
 * It reads the sending state in the same statement because that value is exactly
 * what the lock is protecting; a second read would be a second chance for it to
 * be the stale one.
 */
async function lockHirerAccount(
  tx: DomainTransaction,
  accountId: string,
): Promise<{ readonly offerSendingState: string } | undefined> {
  const [row] = await tx
    .select({ offerSendingState: schema.user.offerSendingState })
    .from(schema.user)
    .where(eq(schema.user.id, accountId))
    .limit(1)
    .for("update");

  return row;
}

export async function sendOffer(
  db: DomainDatabase,
  accountId: string,
  input: SendOfferInput,
): Promise<SendOfferOutcome> {
  return db.transaction(async (tx) => {
    // 1. The lock, first, and his state read beneath it. See `lockHirerAccount`.
    const account = await lockHirerAccount(tx, accountId);

    /**
     * A session naming an Account that is not there is not an ordinary form
     * answer, and `accountActionClient` has already resolved a live session by
     * the time this runs — so this is the most restrictive answer rather than a
     * refusal with a sentence, and the surface renders the same thing it renders
     * for a freeze.
     */
    const sendingState =
      asOfferSendingState(account?.offerSendingState ?? "") ?? MOST_RESTRICTIVE_OFFER_SENDING_STATE;

    if (sendingState !== "active") {
      return { ok: false as const, reason: "may_not_send" as const, state: sendingState };
    }

    /**
     * Her profile, read inside the same transaction. `published` is part of the
     * predicate rather than a check afterwards, so a profile taken down while he
     * was writing produces the same answer as a slug naming nobody.
     */
    const [profile] = await tx
      .select({
        id: schema.capabilityProfile.id,
        accountId: schema.capabilityProfile.accountId,
      })
      .from(schema.capabilityProfile)
      .where(
        and(
          eq(schema.capabilityProfile.slug, input.profileSlug),
          eq(schema.capabilityProfile.state, "published"),
        ),
      )
      .limit(1);

    if (!profile) return { ok: false as const, reason: "profile_not_found" as const };

    /**
     * **A Worker may not send an Offer to her own profile** (DD9). It inflates
     * `delivered_offer_count`, which is NFR22's ordering input, so the fairness
     * mechanism would otherwise be defeatable in one request by the person it
     * exists to protect.
     */
    if (profile.accountId === accountId) {
      return { ok: false as const, reason: "own_profile" as const };
    }

    // 2. The Block edge, beneath the same lock. One lookup: both columns are
    //    equalities against the edge's own natural key.
    const [blocked] = await tx
      .select({ hirerAccountId: schema.block.hirerAccountId })
      .from(schema.block)
      .where(
        and(
          eq(schema.block.workerProfileId, profile.id),
          eq(schema.block.hirerAccountId, accountId),
        ),
      )
      .limit(1);

    if (blocked) return { ok: false as const, reason: "blocked" as const };

    /**
     * **Whether this is his first Offer, answered from his Consent row.** The
     * *autorización* is taken once, before his first Offer takes a field, so its
     * presence is the fact — and reading it here rather than trusting a flag the
     * browser sent is what stops a request declaring itself a repeat in order to
     * skip the consent step.
     */
    const consented = await hasConsented(tx, accountId, "hirer");

    // 3. The rejector, and the identity fields where this is the first Offer.
    const refusals = refusalsForTerms(input);

    if (!consented) {
      refusals.push(
        ...(input.identity
          ? refusalsForIdentity(input.identity)
          : [{ field: "hirerName", code: "identity_required" } as const]),
      );
    }

    if (refusals.length > 0) {
      return { ok: false as const, reason: "refused" as const, refusals };
    }

    // 4. The Offer. Its id is minted by the schema's `$defaultFn`, in the
    //    application, so it exists before the insert (DD2).
    const [written] = await tx
      .insert(schema.offer)
      .values({
        capabilityProfileId: profile.id,
        hirerAccountId: accountId,
        workDescription: input.workDescription,
        payTerms: input.payTerms,
        whenText: input.whenText,
        state: INITIAL_OFFER_STATE,
      })
      .returning({ id: schema.offer.id });

    // `RETURNING` on an insert always yields the row; a missing one means the
    // driver did something this code does not model, and throwing rolls back.
    if (!written) {
      throw new Error("Inserting the Offer returned no row; the transaction rolls back.");
    }

    // 5. His name and number, on the first Offer only — never on a later one,
    //    because the name a Worker already read may not change under her.
    if (!consented && input.identity) {
      const phone = normalizeColombianPhone(input.identity.hirerPhone);

      await tx
        .update(schema.user)
        .set({
          hirerName: input.identity.hirerName.trim(),
          // `refusalsForIdentity` has already refused an unreadable number, so
          // the fallback is unreachable; it is the raw input rather than an
          // empty string so that a disagreement between the two functions would
          // store what he typed instead of losing it.
          hirerPhone: phone.ok ? phone.e164 : input.identity.hirerPhone.trim(),
        })
        .where(eq(schema.user.id, accountId));

      // 6. Last, inside the same transaction, and it throws on a stale version —
      //    which rolls back the Offer and the identity above it. See `#consent`.
      await recordConsent(tx, {
        accountId,
        side: "hirer",
        versions: input.consentVersions,
      });
    }

    return { ok: true as const, offerId: written.id };
  });
}

/**
 * Every Offer one Hirer has sent, newest first, with the person he sent it to.
 *
 * **The clock is a parameter**, so every row on one screen agrees about what
 * "24 hours ago" means and nothing below this reads the current time — the rule
 * Cache Components enforces from the other side.
 *
 * **Scoped by the sender, in the `where` clause rather than afterwards.** Every
 * function here takes the principal and no unscoped finder is exported, which is
 * the API contract's ownership rule made structural.
 *
 * One statement, with her Skills arriving through the correlated aggregate in
 * `#profiles/public-columns` — a list that read its rows and then asked for each
 * row's Skills would look correct and cost one query per row.
 */
export async function listSentOffers(
  db: DomainDatabase,
  accountId: string,
  now: Date,
): Promise<readonly SentOffer[]> {
  const rows = await db
    .select({
      id: schema.offer.id,
      state: schema.offer.state,
      workDescription: schema.offer.workDescription,
      payTerms: schema.offer.payTerms,
      whenText: schema.offer.whenText,
      sentAt: schema.offer.createdAt,
      deliveredAt: schema.offer.deliveredAt,
      ...PUBLIC_COLUMNS,
    })
    .from(schema.offer)
    .innerJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.offer.capabilityProfileId),
    )
    .where(eq(schema.offer.hirerAccountId, accountId))
    .orderBy(sql`${schema.offer.createdAt} desc`);

  return rows.map((row) =>
    toSentOffer(
      {
        id: row.id,
        state: row.state,
        workDescription: row.workDescription,
        payTerms: row.payTerms,
        whenText: row.whenText,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        worker: toPublic(row),
        // Neither reaches the sender's own list: he wrote them, and the
        // projection carries nothing about him back to him.
        hirerName: null,
        hirerPhone: null,
      },
      now,
    ),
  );
}

/** One Offer waiting for a person to read it, as the Admin queue needs it. */
export interface PendingOffer {
  readonly id: string;
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
  readonly sentAt: Date;
  /**
   * Her display identity — first name and last initial, which is what NFR11
   * permits an Offer queue item to render. Not her phone, and not her full name.
   */
  readonly workerFirstName: string;
  readonly workerLastInitial: string;
  /** What he called himself, badged as declared rather than verified (C4). */
  readonly hirerName: string | null;
}

/**
 * The Admin queue's Offer branch: the oldest few rows, the depth, and the age of
 * the oldest.
 *
 * **The cap is on the rendering and never on the count** (C55). A page capped at
 * fifty that also reported a depth of fifty would be an instrument that goes
 * green exactly when the backlog is at its worst, and NFR7's detector would be
 * silently disabled. So the rows take a `LIMIT` and the two figures are computed
 * over the whole predicate, in a second statement.
 *
 * **Oldest first**, which is the order the queue is worked in and the order the
 * partial index already holds.
 */
export async function pendingOffers(
  db: DomainDatabase,
  displayCap: number,
): Promise<{
  readonly items: readonly PendingOffer[];
  readonly total: number;
  readonly oldestSentAt: Date | null;
}> {
  const waiting = sql`${schema.offer.state} in ('pending_review', 'on_hold')`;

  const rows = await db
    .select({
      id: schema.offer.id,
      workDescription: schema.offer.workDescription,
      payTerms: schema.offer.payTerms,
      whenText: schema.offer.whenText,
      sentAt: schema.offer.createdAt,
      workerFirstName: schema.capabilityProfile.firstName,
      workerLastInitial: schema.capabilityProfile.lastInitial,
      hirerName: schema.user.hirerName,
    })
    .from(schema.offer)
    .innerJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.offer.capabilityProfileId),
    )
    .innerJoin(schema.user, eq(schema.user.id, schema.offer.hirerAccountId))
    .where(waiting)
    .orderBy(schema.offer.createdAt)
    .limit(displayCap);

  const [figures] = await db
    .select({ total: count(), oldestSentAt: min(schema.offer.createdAt) })
    .from(schema.offer)
    .where(waiting);

  return {
    items: rows,
    total: figures?.total ?? 0,
    oldestSentAt: figures?.oldestSentAt ?? null,
  };
}

/**
 * **The pooled binding: what a Server Component or a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass. The
 * dynamic import is the mechanism `ceilings`, `consent` and `admin` already use,
 * and for the same reason: `#connection` carries `import "server-only"`, which
 * throws under plain `node`, and a static import here would make this module
 * unimportable at seam 1 and seam 2 — the two places its logic is tested.
 *
 * **Delivering an Offer has no entry here.** It is an Admin action, so it is
 * reached through `runAdminAction`, which writes the `AdminAction` row in the
 * same transaction (NFR33) — a binding on this object would be a second way to
 * deliver one, and it would be the unaudited way.
 */
export const offers = {
  async send(accountId: string, input: SendOfferInput): Promise<SendOfferOutcome> {
    const { db } = await import("#connection");
    return sendOffer(db(), accountId, input);
  },

  async listSent(accountId: string, now: Date): Promise<readonly SentOffer[]> {
    const { db } = await import("#connection");
    return listSentOffers(db(), accountId, now);
  },

  async pending(displayCap: number) {
    const { db } = await import("#connection");
    return pendingOffers(db(), displayCap);
  },
};

export { PENDING_OFFER_STATES };
export type { SentOffer } from "#projections";
