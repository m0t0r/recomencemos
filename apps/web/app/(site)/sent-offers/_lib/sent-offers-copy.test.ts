/**
 * `/sent-offers`' copy, against `docs/policy/voice.md`.
 *
 * Beyond the shared rules `describeSurfaceCopy` holds, this surface owes two
 * things nowhere else does: the normal window stated **before** it is exceeded,
 * and the delayed sentence said plainly rather than through a colour or a badge.
 */

import { OFFER_STATES } from "@repo/domain/policy";
import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  OFFER_JUST_SENT,
  OFFER_PAY_LABEL,
  OFFER_PROFILE_LINK,
  OFFER_REVIEW_DELAYED,
  OFFER_STATE_SENTENCES,
  OFFER_TERMS_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerRecipient,
  offerSentOn,
  SENT_OFFERS_EMPTY_BODY,
  SENT_OFFERS_EMPTY_HEADING,
  SENT_OFFERS_EMPTY_LINK,
  SENT_OFFERS_FAILED,
  SENT_OFFERS_HEADING,
  SENT_OFFERS_LEAD,
  SENT_OFFERS_TITLE,
  sentOffersCount,
} from "./messages";

describeSurfaceCopy({
  copy: [
    ["SENT_OFFERS_TITLE", SENT_OFFERS_TITLE],
    ["SENT_OFFERS_HEADING", SENT_OFFERS_HEADING],
    ["SENT_OFFERS_LEAD", SENT_OFFERS_LEAD],
    ["SENT_OFFERS_EMPTY_HEADING", SENT_OFFERS_EMPTY_HEADING],
    ["SENT_OFFERS_EMPTY_BODY", SENT_OFFERS_EMPTY_BODY],
    ["SENT_OFFERS_EMPTY_LINK", SENT_OFFERS_EMPTY_LINK],
    ["SENT_OFFERS_FAILED", SENT_OFFERS_FAILED],
    ["OFFER_JUST_SENT", OFFER_JUST_SENT],
    ["OFFER_REVIEW_DELAYED", OFFER_REVIEW_DELAYED],
    ["OFFER_TERMS_LABEL", OFFER_TERMS_LABEL],
    ["OFFER_WORK_LABEL", OFFER_WORK_LABEL],
    ["OFFER_PAY_LABEL", OFFER_PAY_LABEL],
    ["OFFER_WHEN_LABEL", OFFER_WHEN_LABEL],
    ["OFFER_PROFILE_LINK", OFFER_PROFILE_LINK],
    ["offerRecipient", offerRecipient("Ana María", "R")],
    ["sentOffersCount(1)", sentOffersCount(1)],
    ["sentOffersCount(3)", sentOffersCount(3)],
    ...Object.entries(OFFER_STATE_SENTENCES).map(
      ([state, sentence]) => [`OFFER_STATE_SENTENCES.${state}`, sentence] as const,
    ),
  ],
  labels: [
    ["SENT_OFFERS_EMPTY_LINK", SENT_OFFERS_EMPTY_LINK],
    ["OFFER_PROFILE_LINK", OFFER_PROFILE_LINK],
    ["OFFER_TERMS_LABEL", OFFER_TERMS_LABEL],
    ["OFFER_WORK_LABEL", OFFER_WORK_LABEL],
    ["OFFER_PAY_LABEL", OFFER_PAY_LABEL],
    ["OFFER_WHEN_LABEL", OFFER_WHEN_LABEL],
  ],
});

describe("every state a row can be in", () => {
  /**
   * **A state with no sentence renders nothing**, and the row would then say
   * nothing about where its Offer is. The set is the domain's, so a state added
   * there is red here rather than silently blank.
   */
  it.each(OFFER_STATES)("%s has a sentence", (state) => {
    expect(OFFER_STATE_SENTENCES[state]?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

describe("the window, and when it is passed", () => {
  /**
   * **Stated before it is exceeded, which is the criterion.** Telling him the
   * normal window only once it has been missed is telling him too late to
   * matter — Do 2, the absence first, applied to a wait.
   */
  it("says the normal window on a waiting row", () => {
    expect(OFFER_STATE_SENTENCES.pending_review).toContain("menos de un día");
    expect(OFFER_STATE_SENTENCES.on_hold).toContain("menos de un día");
  });

  /** C41's own words: plainly, that this one is taking longer than usual. */
  it("says a delayed review is taking longer than usual", () => {
    expect(OFFER_REVIEW_DELAYED.toLowerCase()).toContain("más de lo normal");
  });

  /**
   * The delay is ours and the sentence says so, with the actor visible (Do 1) —
   * without apologising for a queue one unpaid person is working, and without
   * asking him to do anything, because there is nothing for him to do.
   */
  it("names us as the ones still reading it", () => {
    expect(OFFER_REVIEW_DELAYED).toContain("Seguimos leyéndola");
  });

  /**
   * **No apology and no promise.** *Perdón* would make our queue his problem to
   * forgive, and a date we cannot keep is the one dishonesty this voice cannot
   * afford (Optimism 3 — we hold no money and can promise no outcome).
   */
  it("neither apologises nor promises a date", () => {
    expect(OFFER_REVIEW_DELAYED.toLowerCase()).not.toMatch(/perd[oó]n|disculp|mañana|pronto/);
  });
});

describe("what a row never says", () => {
  /**
   * **No read receipt.** Delivery here means *a person let it through*, not
   * *she opened it*, and a sentence claiming the second would be a claim this
   * product cannot make about anybody.
   */
  it("does not claim she read it", () => {
    expect(OFFER_STATE_SENTENCES.delivered.toLowerCase()).not.toMatch(/ley[óo]|abri[óo]|vist/);
  });

  /** Whose decision it is, said as a fact rather than as encouragement. */
  it("says the decision is hers", () => {
    expect(OFFER_STATE_SENTENCES.delivered).toContain("ella decide");
  });

  /**
   * A declined Offer is a decision, not a failure, and it is not about him. No
   * *lo siento*, no *lamentablemente*, no reason invented on her behalf.
   */
  it("says a decline plainly and explains nothing on her behalf", () => {
    const sentence = OFFER_STATE_SENTENCES.declined.toLowerCase();

    expect(sentence).not.toMatch(/lo siento|lamentab|desafortunad|porque/);
  });
});

describe("the empty state", () => {
  /** It routes into the list; it does not read as an error or as an absence. */
  it("says what an Offer is for and where to write one", () => {
    expect(SENT_OFFERS_EMPTY_BODY).toContain("qué trabajo necesitas");
    expect(SENT_OFFERS_EMPTY_LINK.toLowerCase()).toContain("perfiles");
  });

  it("does not read as something having gone wrong", () => {
    const both = `${SENT_OFFERS_EMPTY_HEADING} ${SENT_OFFERS_EMPTY_BODY}`.toLowerCase();

    expect(both).not.toMatch(/error|no encontramos|vac[íi]o/);
  });
});

describe("the date on a row", () => {
  /**
   * `es-CO` long form. Never `08/10/2026`, which reads as August in one country
   * and October in another — and this product's two sides are in different ones.
   */
  it("writes the month as a word", () => {
    expect(offerSentOn(new Date("2026-09-08T12:00:00Z"))).toContain("septiembre");
  });

  it("carries no slashes", () => {
    expect(offerSentOn(new Date("2026-09-08T12:00:00Z"))).not.toContain("/");
  });
});

describe("the count", () => {
  it("counts one in the singular", () => {
    expect(sentOffersCount(1)).toBe("1 propuesta");
    expect(sentOffersCount(3)).toBe("3 propuestas");
  });
});
