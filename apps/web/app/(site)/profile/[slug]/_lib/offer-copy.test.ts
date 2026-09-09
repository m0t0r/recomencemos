/**
 * The Offer form's copy, against `docs/policy/voice.md`.
 *
 * `describeSurfaceCopy` holds the rules every surface shares — the banned
 * vocabulary, ALL CAPS, exclamation marks, empty link text, the sentence and
 * label ceilings. What is here beyond that is the part this surface owes on its
 * own: the two facts stated before he writes, the refusals that say what changes
 * and when, and the sentences that must not appear.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  HIRER_NAME_HELP,
  HIRER_NAME_LABEL,
  HIRER_NAME_REQUIRED,
  HIRER_NAME_TOO_LONG,
  HIRER_PHONE_HELP,
  HIRER_PHONE_LABEL,
  HIRER_PHONE_LOOKS_WRONG,
  OFFER_BLOCKED,
  OFFER_HEADING,
  OFFER_IMMUTABLE_NOTICE,
  OFFER_OWN_PROFILE,
  OFFER_PAGE_STALE,
  OFFER_PROFILE_GONE,
  OFFER_REVIEW_NOTICE,
  OFFER_REVIEW_WINDOW,
  OFFER_SEND_FAILED,
  OFFER_SENDING_BANNED,
  OFFER_SENDING_FROZEN,
  OFFER_SENT_HEADING,
  OFFER_SENT_IMMUTABLE,
  OFFER_SENT_LINK,
  OFFER_SENT_REVIEW,
  OFFER_SUMMARY_KEPT,
  OFFER_SUMMARY_LABEL,
  offerContactDetailRefusal,
  offerSummaryHeading,
  PAY_HELP,
  PAY_LABEL,
  PAY_REQUIRED,
  PAY_TOO_LONG,
  SEND_OFFER_BUTTON,
  SEND_OFFER_PENDING,
  WHEN_HELP,
  WHEN_LABEL,
  WHEN_REQUIRED,
  WHEN_TOO_LONG,
  WORK_HELP,
  WORK_LABEL,
  WORK_TOO_LONG,
  WORK_TOO_SHORT,
} from "./offer-messages";

describeSurfaceCopy({
  copy: [
    ["OFFER_HEADING", OFFER_HEADING],
    ["OFFER_REVIEW_NOTICE", OFFER_REVIEW_NOTICE],
    ["OFFER_REVIEW_WINDOW", OFFER_REVIEW_WINDOW],
    ["OFFER_IMMUTABLE_NOTICE", OFFER_IMMUTABLE_NOTICE],
    ["WORK_LABEL", WORK_LABEL],
    ["WORK_HELP", WORK_HELP],
    ["PAY_LABEL", PAY_LABEL],
    ["PAY_HELP", PAY_HELP],
    ["WHEN_LABEL", WHEN_LABEL],
    ["WHEN_HELP", WHEN_HELP],
    ["HIRER_NAME_LABEL", HIRER_NAME_LABEL],
    ["HIRER_NAME_HELP", HIRER_NAME_HELP],
    ["HIRER_PHONE_LABEL", HIRER_PHONE_LABEL],
    ["HIRER_PHONE_HELP", HIRER_PHONE_HELP],
    ["SEND_OFFER_BUTTON", SEND_OFFER_BUTTON],
    ["SEND_OFFER_PENDING", SEND_OFFER_PENDING],
    ["OFFER_SENT_HEADING", OFFER_SENT_HEADING],
    ["OFFER_SENT_REVIEW", OFFER_SENT_REVIEW],
    ["OFFER_SENT_IMMUTABLE", OFFER_SENT_IMMUTABLE],
    ["OFFER_SENT_LINK", OFFER_SENT_LINK],
    ["OFFER_SUMMARY_KEPT", OFFER_SUMMARY_KEPT],
    ["OFFER_SUMMARY_LABEL", OFFER_SUMMARY_LABEL],
    ["OFFER_BLOCKED", OFFER_BLOCKED],
    ["OFFER_SENDING_FROZEN", OFFER_SENDING_FROZEN],
    ["OFFER_SENDING_BANNED", OFFER_SENDING_BANNED],
    ["OFFER_PROFILE_GONE", OFFER_PROFILE_GONE],
    ["OFFER_OWN_PROFILE", OFFER_OWN_PROFILE],
    ["OFFER_SEND_FAILED", OFFER_SEND_FAILED],
    ["OFFER_PAGE_STALE", OFFER_PAGE_STALE],
    ["WORK_TOO_SHORT", WORK_TOO_SHORT],
    ["WORK_TOO_LONG", WORK_TOO_LONG],
    ["PAY_REQUIRED", PAY_REQUIRED],
    ["PAY_TOO_LONG", PAY_TOO_LONG],
    ["WHEN_REQUIRED", WHEN_REQUIRED],
    ["WHEN_TOO_LONG", WHEN_TOO_LONG],
    ["HIRER_NAME_REQUIRED", HIRER_NAME_REQUIRED],
    ["HIRER_NAME_TOO_LONG", HIRER_NAME_TOO_LONG],
    ["HIRER_PHONE_LOOKS_WRONG", HIRER_PHONE_LOOKS_WRONG],
    ["offerSummaryHeading(1)", offerSummaryHeading(1)],
    ["offerSummaryHeading(3)", offerSummaryHeading(3)],
    ["offerContactDetailRefusal(phone)", offerContactDetailRefusal("phone", "300 123 4567")],
    ["offerContactDetailRefusal(email)", offerContactDetailRefusal("email", "ana@example.com")],
    ["offerContactDetailRefusal(url)", offerContactDetailRefusal("messaging_url", "wa.me/57300")],
  ],
  labels: [
    ["WORK_LABEL", WORK_LABEL],
    ["PAY_LABEL", PAY_LABEL],
    ["WHEN_LABEL", WHEN_LABEL],
    ["HIRER_NAME_LABEL", HIRER_NAME_LABEL],
    ["HIRER_PHONE_LABEL", HIRER_PHONE_LABEL],
    ["SEND_OFFER_BUTTON", SEND_OFFER_BUTTON],
    ["SEND_OFFER_PENDING", SEND_OFFER_PENDING],
    ["OFFER_SENT_LINK", OFFER_SENT_LINK],
  ],
});

describe("the two facts he is told before he writes", () => {
  /**
   * The acceptance criterion, and the tone matrix's own rule for this surface. A
   * Hirer who learns after submitting that a person reads it first has learned
   * it too late to have written differently.
   */
  it("says a person reads it, in the present tense with the actor visible", () => {
    expect(OFFER_REVIEW_NOTICE).toContain("Una persona lee");
    // Never the passive: *es revisada* hides who acted, and the actor is us.
    expect(OFFER_REVIEW_NOTICE.toLowerCase()).not.toContain("revisada");
  });

  it("says how long that usually takes", () => {
    expect(OFFER_REVIEW_WINDOW).toContain("menos de un día");
  });

  it("says he cannot change it", () => {
    expect(OFFER_IMMUTABLE_NOTICE.toLowerCase()).toContain("cambiar");
  });

  /** All three again on the confirmation, because that is the criterion too. */
  it("says all three again after he sends", () => {
    expect(OFFER_SENT_REVIEW).toContain("Una persona la lee");
    expect(OFFER_SENT_REVIEW).toContain("menos de un día");
    expect(OFFER_SENT_IMMUTABLE.toLowerCase()).toContain("no se puede cambiar");
  });
});

describe("the refusals", () => {
  /**
   * NFR12's own words: the rejection **names the fragment it objected to**. Do 4
   * — a refusal he can check is a refusal he can trust.
   */
  it.each([
    ["phone", "300 123 4567"],
    ["email", "ana@example.com"],
    ["messaging_url", "wa.me/57300"],
  ] as const)("quotes the %s fragment back in guillemets", (kind, fragment) => {
    expect(offerContactDetailRefusal(kind, fragment)).toContain(`«${fragment}»`);
  });

  /**
   * **No copy claims the field is a filter** (NFR12's second half). The rejector
   * is a speed bump and human review is the control; a sentence promising the
   * field catches contact details would be a protection nobody has.
   */
  it.each([
    ["phone", "300 123 4567"],
    ["email", "ana@example.com"],
    ["messaging_url", "wa.me/57300"],
  ] as const)("claims no filtering on the %s refusal", (kind, fragment) => {
    const sentence = offerContactDetailRefusal(kind, fragment).toLowerCase();

    expect(sentence).not.toMatch(/filtr|bloquea|detecta|no se permite/);
  });

  it("says what to do next, in the same breath", () => {
    expect(offerContactDetailRefusal("phone", "300 123 4567")).toContain("Quítalo");
  });

  /**
   * **The Block sentence says nothing about a Block.** `CONTEXT.md` bans
   * describing it as making her invisible, and this says neither that nor who
   * decided, when, or why — only that she is not receiving Offers from him, and
   * where else he can look.
   */
  it("says a Blocked sender nothing about who decided, when, or why", () => {
    const sentence = OFFER_BLOCKED.toLowerCase();

    expect(sentence).not.toMatch(/bloque|report|decid|silenci|ocult/);
    expect(sentence).toContain("no está recibiendo propuestas tuyas");
  });

  it("gives a Blocked sender somewhere else to look", () => {
    expect(OFFER_BLOCKED).toContain("muro");
  });

  /** Don't 4: no *más tarde*, no *en este momento*, on any refusal. */
  it.each([
    ["OFFER_BLOCKED", OFFER_BLOCKED],
    ["OFFER_SENDING_FROZEN", OFFER_SENDING_FROZEN],
    ["OFFER_SENDING_BANNED", OFFER_SENDING_BANNED],
    ["OFFER_PROFILE_GONE", OFFER_PROFILE_GONE],
    ["OFFER_OWN_PROFILE", OFFER_OWN_PROFILE],
  ])("%s softens nothing into ambiguity", (_name, sentence) => {
    expect(sentence.toLowerCase()).not.toMatch(/más tarde|en este momento|inténtalo luego/);
  });

  /**
   * A frozen Account is a decision this platform took about him, and he is
   * entitled to know it — the export already tells him the same thing. What the
   * sentence must not do is leave him guessing whether his own words survived.
   */
  it("tells a frozen sender what is happening and that nothing was lost", () => {
    expect(OFFER_SENDING_FROZEN).toContain("revisa un reporte");
    expect(OFFER_SENDING_FROZEN).toContain("Nada de lo que escribiste se perdió");
  });
});

describe("the summary", () => {
  it("counts one in the singular", () => {
    expect(offerSummaryHeading(1)).toContain("una cosa");
    expect(offerSummaryHeading(1)).not.toContain("1 cosas");
  });

  it("says nothing he typed was lost", () => {
    expect(OFFER_SUMMARY_KEPT.toLowerCase()).toContain("sigue en el formulario");
  });
});

describe("the two self-asserted fields", () => {
  /**
   * ADR-0008 from the side that usually goes unsaid: story 11's notice tells
   * *her* that a Hirer's name and phone are self-asserted, and this tells *him*
   * that what he writes is what she reads, unchecked.
   */
  it.each([
    ["HIRER_NAME_HELP", HIRER_NAME_HELP],
    ["HIRER_PHONE_HELP", HIRER_PHONE_HELP],
  ])("%s says nobody comprueba it", (_name, help) => {
    expect(help.toLowerCase()).toContain("nadie lo comprueba");
  });

  /** And the phone help says the one thing he actually needs to know about it. */
  it("says his number crosses only if she accepts", () => {
    expect(HIRER_PHONE_HELP).toContain("solo si ella acepta");
  });
});
