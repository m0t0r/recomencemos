/**
 * The two parties to an Offer, and an Offer between them — for the suites that
 * test what happens once one exists.
 *
 * **Each is written through the module that owns it**: a profile through
 * `publishProfile`, an Offer through `sendOffer`. Moving an Offer past
 * `pending_review` is the Admin's act and is reached through `runAdminAction`
 * in production; here the fixture writes the state directly, which is the same
 * reach for the handle `offers.integration.test.ts` makes when it backdates an
 * arrival.
 *
 * **Every value NFR11 holds back until she accepts is distinct and
 * unmistakable**, so a suite can search a whole response for any one of them and
 * know what it found.
 */

import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/index";
import { sendOffer } from "#offers";
import type { OfferState } from "#policy/offer-states";
import { publishProfile } from "#profiles";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import type { TestDatabase } from "#testing/fixtures";

export const WORKER = {
  email: "ana.sentinel@recomencemos.test",
  fullName: "Ana María Restrepo Gómez",
  phoneDigits: "3001234567",
} as const;

export const HIRER = {
  email: "carlos.sentinel@recomencemos.test",
  name: "Carlos Restrepo",
  phoneDigits: "3105558899",
} as const;

export const TERMS = {
  workDescription: "Necesito que cocines almuerzos para ocho personas el sábado",
  payTerms: "$120.000 por el día, pagados el mismo sábado",
  whenText: "Sábado 12 de septiembre, desde las 7 de la mañana",
} as const;

/** A published Worker, through the module that owns publishing. */
export async function aWorker(database: TestDatabase, email: string = WORKER.email) {
  const accountId = await signedInAccountId(database, email);

  const published = await publishProfile(database.db, accountId, {
    fullName: WORKER.fullName,
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
    headline: "Cocino almuerzos y comida casera para eventos pequeños",
    about: "Catorce años cocinando para familias y oficinas.",
    phone: `+57${WORKER.phoneDigits}`,
    skillSlugs: ["home-cooking"],
    workHistory: ["Cocina de un restaurante en el centro de Pereira"],
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!published.ok) throw new Error("the fixture profile did not publish");

  return { accountId, slug: published.slug };
}

/** A signed-in Account with nothing yet — it becomes a Hirer by sending. */
export async function aHirer(database: TestDatabase, email: string = HIRER.email) {
  return signedInAccountId(database, email);
}

/** One Offer from `hirer` to `slug`, left in `state` — its id. */
export async function anOfferIn(
  database: TestDatabase,
  hirer: string,
  slug: string,
  state: OfferState = "delivered",
  workDescription: string = TERMS.workDescription,
): Promise<string> {
  const sent = await sendOffer(database.db, hirer, {
    ...TERMS,
    workDescription,
    profileSlug: slug,
    identity: { hirerName: HIRER.name, hirerPhone: HIRER.phoneDigits },
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!sent.ok) throw new Error(`the fixture Offer did not send: ${sent.reason}`);

  if (state !== "pending_review") {
    await database.db
      .update(schema.offer)
      .set({
        state,
        deliveredAt: state === "on_hold" || state === "rejected_by_admin" ? null : new Date(),
      })
      .where(eq(schema.offer.id, sent.offerId));
  }

  return sent.offerId;
}
