/**
 * `/offers` and `/offers/[id]`'s copy, against `docs/policy/voice.md`.
 *
 * Beyond the shared rules `describeSurfaceCopy` holds, these surfaces owe three
 * things nowhere else does: the confirmation names every field that crosses and
 * that it cannot be undone, the absence of verification is said before the
 * Hirer's name, and nothing on either page nudges her towards an answer.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  ACCEPT,
  ACCEPT_CONFIRM,
  ACCEPT_IRREVERSIBLE,
  acceptConsequence,
  ACCEPTING,
  ALREADY_ANSWERED,
  ANSWER_HEADING,
  BACK_TO_OFFERS,
  CANCEL,
  DECLINE,
  DECLINING,
  JUST_ACCEPTED,
  JUST_DECLINED,
  OFFER_GONE,
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
  OFFERS_FAILED_RETRY,
  OFFERS_FAILED_RETRYING,
  OPEN_OFFER_LINK,
  RECEIVED_OFFER_FAILED_TITLE,
  RECEIVED_OFFER_HEADING,
  RECEIVED_OFFER_TITLE,
  RECEIVED_OFFERS_EMPTY_BODY,
  RECEIVED_OFFERS_EMPTY_HEADING,
  RECEIVED_OFFERS_EMPTY_LINK,
  RECEIVED_OFFERS_FAILED_EXPLANATION,
  RECEIVED_OFFERS_FAILED_TITLE,
  RECEIVED_OFFERS_HEADING,
  RECEIVED_OFFERS_LEAD,
  RECEIVED_OFFERS_NO_PROFILE_BODY,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
  RECEIVED_OFFERS_TITLE,
  RECEIVED_STATE_LABELS,
  RECEIVED_STATE_SENTENCES,
  receivedOffersCount,
  SENDER_ABSENCE,
  SENDER_LABEL,
  SENDER_NAMED_NOTE,
  SENDER_UNNAMED,
  senderClaim,
} from "./messages";

describeSurfaceCopy({
  copy: [
    ["RECEIVED_OFFERS_TITLE", RECEIVED_OFFERS_TITLE],
    ["RECEIVED_OFFERS_HEADING", RECEIVED_OFFERS_HEADING],
    ["RECEIVED_OFFERS_LEAD", RECEIVED_OFFERS_LEAD],
    ["RECEIVED_OFFERS_EMPTY_HEADING", RECEIVED_OFFERS_EMPTY_HEADING],
    ["RECEIVED_OFFERS_EMPTY_BODY", RECEIVED_OFFERS_EMPTY_BODY],
    ["RECEIVED_OFFERS_EMPTY_LINK", RECEIVED_OFFERS_EMPTY_LINK],
    ["RECEIVED_OFFERS_NO_PROFILE_BODY", RECEIVED_OFFERS_NO_PROFILE_BODY],
    ["RECEIVED_OFFERS_NO_PROFILE_LINK", RECEIVED_OFFERS_NO_PROFILE_LINK],
    ["RECEIVED_OFFERS_FAILED_TITLE", RECEIVED_OFFERS_FAILED_TITLE],
    ["RECEIVED_OFFERS_FAILED_EXPLANATION", RECEIVED_OFFERS_FAILED_EXPLANATION],
    ["RECEIVED_OFFER_FAILED_TITLE", RECEIVED_OFFER_FAILED_TITLE],
    ["OFFERS_FAILED_RETRY", OFFERS_FAILED_RETRY],
    ["OFFERS_FAILED_RETRYING", OFFERS_FAILED_RETRYING],
    ["receivedOffersCount(1)", receivedOffersCount(1)],
    ["receivedOffersCount(5)", receivedOffersCount(5)],
    ["OFFER_WORK_LABEL", OFFER_WORK_LABEL],
    ["OFFER_PAY_LABEL", OFFER_PAY_LABEL],
    ["OFFER_WHEN_LABEL", OFFER_WHEN_LABEL],
    ["offerSentOn", offerSentOn(new Date("2026-09-10T12:00:00Z"))],
    ["OPEN_OFFER_LINK", OPEN_OFFER_LINK],
    ["SENDER_LABEL", SENDER_LABEL],
    ["SENDER_ABSENCE", SENDER_ABSENCE],
    ["SENDER_NAMED_NOTE", SENDER_NAMED_NOTE],
    ["SENDER_UNNAMED", SENDER_UNNAMED],
    ["senderClaim(name)", senderClaim("Carlos Restrepo")],
    ["RECEIVED_OFFER_TITLE", RECEIVED_OFFER_TITLE],
    ["RECEIVED_OFFER_HEADING", RECEIVED_OFFER_HEADING],
    ["BACK_TO_OFFERS", BACK_TO_OFFERS],
    ["ANSWER_HEADING", ANSWER_HEADING],
    ["ACCEPT", ACCEPT],
    ["DECLINE", DECLINE],
    ["CANCEL", CANCEL],
    ["acceptConsequence(name)", acceptConsequence("Carlos Restrepo")],
    ["acceptConsequence(null)", acceptConsequence(null)],
    ["ACCEPT_IRREVERSIBLE", ACCEPT_IRREVERSIBLE],
    ["ACCEPT_CONFIRM", ACCEPT_CONFIRM],
    ["ACCEPTING", ACCEPTING],
    ["DECLINING", DECLINING],
    ["JUST_ACCEPTED", JUST_ACCEPTED],
    ["JUST_DECLINED", JUST_DECLINED],
    ["ALREADY_ANSWERED", ALREADY_ANSWERED],
    ["OFFER_GONE", OFFER_GONE],
    ...Object.entries(RECEIVED_STATE_LABELS).map(
      ([state, label]) => [`RECEIVED_STATE_LABELS.${state}`, label] as const,
    ),
    ...Object.entries(RECEIVED_STATE_SENTENCES).map(
      ([state, sentence]) => [`RECEIVED_STATE_SENTENCES.${state}`, sentence] as const,
    ),
  ],
  labels: [
    ["RECEIVED_OFFERS_EMPTY_LINK", RECEIVED_OFFERS_EMPTY_LINK],
    ["RECEIVED_OFFERS_NO_PROFILE_LINK", RECEIVED_OFFERS_NO_PROFILE_LINK],
    ["OFFERS_FAILED_RETRY", OFFERS_FAILED_RETRY],
    ["OFFERS_FAILED_RETRYING", OFFERS_FAILED_RETRYING],
    ["OFFER_WORK_LABEL", OFFER_WORK_LABEL],
    ["OFFER_PAY_LABEL", OFFER_PAY_LABEL],
    ["OFFER_WHEN_LABEL", OFFER_WHEN_LABEL],
    ["OPEN_OFFER_LINK", OPEN_OFFER_LINK],
    ["BACK_TO_OFFERS", BACK_TO_OFFERS],
    ["ACCEPT", ACCEPT],
    ["DECLINE", DECLINE],
    ["CANCEL", CANCEL],
    ["ACCEPT_CONFIRM", ACCEPT_CONFIRM],
    ...Object.entries(RECEIVED_STATE_LABELS).map(
      ([state, label]) => [`RECEIVED_STATE_LABELS.${state}`, label] as const,
    ),
  ],
});

describe("the second step of accepting", () => {
  /**
   * **The criterion is that it names what crosses** — all three of hers, and
   * that his come back — and says it cannot be undone. A confirmation reading
   * "tus datos" names nothing she can check.
   */
  it("names her three fields and that his cross back", () => {
    const sentence = acceptConsequence("Carlos Restrepo");

    expect(sentence).toContain("Carlos Restrepo");
    expect(sentence).toContain("tu nombre completo");
    expect(sentence).toContain("tu teléfono");
    expect(sentence).toContain("tu correo");
    expect(sentence).toContain("Tú recibes los suyos");
  });

  it("says it cannot be undone", () => {
    expect(ACCEPT_IRREVERSIBLE).toContain("no se puede deshacer");
  });

  /** With no name to say, it names the role — mid-sentence, so in lower case. */
  it("names the role in lower case when there is no name", () => {
    expect(acceptConsequence(null)).toContain("Si aceptas, quien envía la propuesta recibe");
  });

  /** The verb of the act, never _Confirmar_ or _Sí_ (voice.md, Sentences). */
  it("says what the button does", () => {
    expect(ACCEPT_CONFIRM).toBe("Aceptar y dar mis datos");
  });
});

describe("who claims to be asking", () => {
  /** Do 2: the absence is said first, and it is the Wall's own sentence. */
  it("says nobody is verified", () => {
    expect(SENDER_ABSENCE).toBe("Aquí no verificamos a nadie.");
  });

  it("says a name is a claim rather than a fact", () => {
    expect(senderClaim("Panadería La Treinta")).toBe("Firma como Panadería La Treinta.");
    expect(senderClaim(null)).toBe(SENDER_UNNAMED);
  });
});

describe("what these pages never do", () => {
  /** Nothing nudges: no exclamation mark on either surface, success included. */
  it("carries no exclamation mark", () => {
    const every = [
      RECEIVED_OFFERS_LEAD,
      RECEIVED_OFFERS_EMPTY_HEADING,
      JUST_ACCEPTED,
      JUST_DECLINED,
      ...Object.values(RECEIVED_STATE_LABELS),
      ...Object.values(RECEIVED_STATE_SENTENCES),
    ];

    for (const string of every) expect(string).not.toContain("!");
  });

  /** A declined Offer is her decision, and nothing crossed. Both are said. */
  it("says a decline crossed nothing", () => {
    expect(RECEIVED_STATE_SENTENCES.declined).toContain("no recibió ninguno de tus datos");
    expect(JUST_DECLINED).toContain("no recibió ninguno de tus datos");
  });

  /** The empty state says what makes one arrive and that a person reads it first. */
  it("says what makes an Offer arrive, and that a person reads it first", () => {
    expect(RECEIVED_OFFERS_EMPTY_BODY).toContain("qué trabajo necesita");
    expect(RECEIVED_OFFERS_EMPTY_BODY).toContain("una persona la lee");
  });

  /** A refusal says what she can do next (Do 3), and never blames her. */
  it("gives a refusal somewhere to go", () => {
    expect(OFFER_GONE).toContain("Las demás siguen");
  });
});
