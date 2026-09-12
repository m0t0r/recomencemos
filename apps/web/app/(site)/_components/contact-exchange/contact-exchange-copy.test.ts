/**
 * The Contact Exchange's copy, against `docs/policy/voice.md`.
 *
 * Beyond the shared rules `describeSurfaceCopy` holds, this surface owes two
 * things the tone matrix's Contact Exchange row names: every copy line says the
 * details are **here** and the mail is only a copy, and the claim sentence puts
 * the absence of verification first.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  COPIED,
  COPY_DETAIL,
  COPY_LINES,
  FOLDED_TERMS,
  EXCHANGE_CLAIM,
  EXCHANGE_HEADING,
  EXCHANGE_LABELS,
  EXCHANGE_LEAD,
  NO_NAME,
  NO_PHONE,
  ownGiven,
} from "./messages";

const OWN = {
  fullName: "Ana María Restrepo Gómez",
  phone: "+573001234567",
  email: "ana@recomencemos.test",
};

describeSurfaceCopy({
  copy: [
    ["EXCHANGE_HEADING.worker", EXCHANGE_HEADING.worker],
    ["EXCHANGE_HEADING.hirer", EXCHANGE_HEADING.hirer],
    ["EXCHANGE_LEAD", EXCHANGE_LEAD],
    ...(["worker", "hirer"] as const).flatMap((side) =>
      Object.entries(EXCHANGE_LABELS[side]).map(
        ([key, label]) => [`EXCHANGE_LABELS.${side}.${key}`, label] as const,
      ),
    ),
    ["NO_NAME", NO_NAME],
    ["NO_PHONE", NO_PHONE],
    ["EXCHANGE_CLAIM.worker", EXCHANGE_CLAIM.worker],
    ["EXCHANGE_CLAIM.hirer", EXCHANGE_CLAIM.hirer],
    ["ownGiven(worker)", ownGiven("worker", OWN)],
    ["ownGiven(hirer)", ownGiven("hirer", OWN)],
    [
      "ownGiven(hirer, no name or number)",
      ownGiven("hirer", { ...OWN, fullName: null, phone: null }),
    ],
    ["COPY_LINES.sent", COPY_LINES.sent],
    ["COPY_LINES.pending", COPY_LINES.pending],
    ["COPY_LINES.failed", COPY_LINES.failed],
  ],
  // The one control is the copy button; a detail is text, and the platform's
  // part is over, so there is no link. The fold's summary is a control too.
  labels: [
    ["COPY_DETAIL", COPY_DETAIL],
    ["COPIED", COPIED],
    ["FOLDED_TERMS.worker", FOLDED_TERMS.worker],
    ["FOLDED_TERMS.hirer", FOLDED_TERMS.hirer],
  ],
});

describe("the copy line", () => {
  /** The screen is the original, whatever happened to the mail. */
  it.each(Object.entries(COPY_LINES))(
    "%s says the details are on this page before it says anything about the mail",
    (_state, line) => {
      expect(line).toContain("esta página");
      expect(line.indexOf("esta página")).toBeLessThan(line.indexOf("correo"));
    },
  );

  it("names no address, so each detail is on the page once", () => {
    for (const line of Object.values(COPY_LINES)) expect(line).not.toContain("@");
  });
});

describe("the claim", () => {
  /** Do 2: the absence first. */
  it.each(Object.entries(EXCHANGE_CLAIM))("%s opens with the absence", (_side, claim) => {
    expect(claim.startsWith("Aquí no verificamos a nadie.")).toBe(true);
  });
});

describe("what the reader gave", () => {
  it("lists all three, joined as a sentence is", () => {
    expect(ownGiven("worker", OWN)).toBe(
      "Quien te envió la propuesta recibió los tuyos: Ana María Restrepo Gómez, 300 123 4567 y ana@recomencemos.test.",
    );
  });

  /** A Hirer with no name or number gave only his address, and that is all that crossed. */
  it("lists only what crossed", () => {
    expect(ownGiven("hirer", { ...OWN, fullName: null, phone: null })).toBe(
      "Esa persona recibió los tuyos: ana@recomencemos.test.",
    );
  });
});
