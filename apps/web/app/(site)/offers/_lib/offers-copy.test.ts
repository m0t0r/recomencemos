/**
 * `/offers`' copy, against `docs/policy/voice.md`.
 *
 * Beyond the shared rules `describeSurfaceCopy` holds, this surface owes four
 * things nowhere else does: the confirmation names every field that crosses and
 * that it cannot be undone, the absence of verification is said before the
 * Hirer's name, a row's name is said as his claim, and nothing on the page
 * nudges her towards an answer.
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
  sentAgo,
  receivedOffersCount,
  rowSignature,
  SENDER_ABSENCE,
  SENDER_LABEL,
  SENDER_NAMED_NOTE,
  SENDER_UNNAMED,
  waitingCount,
} from "./messages";

const NOW = new Date("2026-09-12T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(elapsed: number): string {
  return sentAgo(new Date(NOW.getTime() - elapsed), NOW);
}

describeSurfaceCopy({
  copy: [
    ["RECEIVED_OFFERS_TITLE", RECEIVED_OFFERS_TITLE],
    ["RECEIVED_OFFERS_HEADING", RECEIVED_OFFERS_HEADING],
    ["RECEIVED_OFFERS_LEAD", RECEIVED_OFFERS_LEAD],
    ["waitingCount(0)", waitingCount(0)],
    ["waitingCount(1)", waitingCount(1)],
    ["waitingCount(4)", waitingCount(4)],
    ["RECEIVED_OFFERS_EMPTY_HEADING", RECEIVED_OFFERS_EMPTY_HEADING],
    ["RECEIVED_OFFERS_EMPTY_BODY", RECEIVED_OFFERS_EMPTY_BODY],
    ["RECEIVED_OFFERS_EMPTY_LINK", RECEIVED_OFFERS_EMPTY_LINK],
    ["RECEIVED_OFFERS_NO_PROFILE_BODY", RECEIVED_OFFERS_NO_PROFILE_BODY],
    ["RECEIVED_OFFERS_NO_PROFILE_LINK", RECEIVED_OFFERS_NO_PROFILE_LINK],
    ["RECEIVED_OFFERS_FAILED_TITLE", RECEIVED_OFFERS_FAILED_TITLE],
    ["RECEIVED_OFFERS_FAILED_EXPLANATION", RECEIVED_OFFERS_FAILED_EXPLANATION],
    ["OFFERS_FAILED_RETRY", OFFERS_FAILED_RETRY],
    ["OFFERS_FAILED_RETRYING", OFFERS_FAILED_RETRYING],
    ["receivedOffersCount(1)", receivedOffersCount(1)],
    ["receivedOffersCount(5)", receivedOffersCount(5)],
    ["rowSignature(name)", rowSignature("Carlos Restrepo")],
    ["rowSignature(null)", rowSignature(null)],
    ["sentAgo(minutes)", ago(20 * MINUTE)],
    ["sentAgo(hours)", ago(5 * HOUR)],
    ["sentAgo(days)", ago(9 * DAY)],
    ["OFFER_WORK_LABEL", OFFER_WORK_LABEL],
    ["OFFER_PAY_LABEL", OFFER_PAY_LABEL],
    ["OFFER_WHEN_LABEL", OFFER_WHEN_LABEL],
    ["offerSentOn", offerSentOn(new Date("2026-09-10T12:00:00Z"))],
    ["SENDER_LABEL", SENDER_LABEL],
    ["SENDER_ABSENCE", SENDER_ABSENCE],
    ["SENDER_NAMED_NOTE", SENDER_NAMED_NOTE],
    ["SENDER_UNNAMED", SENDER_UNNAMED],
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

  /**
   * A row leads with the name, so the name is said as what he signed with —
   * and an Offer with no name says so rather than rendering a blank.
   */
  it("says a row's name is his signature rather than a fact", () => {
    expect(rowSignature("Panadería La Treinta")).toBe("Firma como Panadería La Treinta");
    expect(rowSignature(null)).toBe("Firma sin nombre");
  });
});

describe("how long ago an Offer arrived", () => {
  it("says under an hour rather than a count of minutes", () => {
    expect(ago(20 * MINUTE)).toBe("hace menos de una hora");
  });

  it("counts hours within the first day", () => {
    expect(ago(HOUR)).toBe("hace 1 hora");
    expect(ago(5 * HOUR)).toBe("hace 5 horas");
  });

  /**
   * Whole days elapsed, and never _ayer_: thirty hours ago can be the day before
   * yesterday on the calendar, and a word she can check should be true.
   */
  it("counts whole days after that, never a calendar word", () => {
    expect(ago(30 * HOUR)).toBe("hace 1 día");
    expect(ago(9 * DAY)).toBe("hace 9 días");
  });

  it("reads a sent time ahead of the server's clock as just arrived", () => {
    expect(ago(-5 * MINUTE)).toBe("hace menos de una hora");
  });
});

describe("the count still waiting on her", () => {
  it("agrees in number, and says none plainly", () => {
    expect(waitingCount(0)).toBe("Ninguna espera tu respuesta.");
    expect(waitingCount(1)).toBe("1 espera tu respuesta.");
    expect(waitingCount(4)).toBe("4 esperan tu respuesta.");
  });
});

describe("what this page never does", () => {
  /** Nothing nudges: no exclamation mark anywhere, success included. */
  it("carries no exclamation mark", () => {
    const every = [
      RECEIVED_OFFERS_LEAD,
      RECEIVED_OFFERS_EMPTY_HEADING,
      waitingCount(3),
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
