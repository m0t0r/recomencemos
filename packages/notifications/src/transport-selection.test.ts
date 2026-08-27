/**
 * Which implementation of the seam runs, and what each branch is allowed to
 * require.
 *
 * The second half is the one that makes the development loop work at all: a
 * developer with no `RESEND_API_KEY` and no verified domain must be able to run
 * #12's whole sign-in flow. That only holds if the `terminal` branch never
 * *asks* for the credential — not merely leaves it unused.
 */

import { AppError } from "@repo/errors/app-error";
import {
  API_KEY_VARIABLE,
  FROM_VARIABLE,
  REPLY_TO_VARIABLE,
  TRANSPORT_VARIABLE,
  createTransport,
  transportName,
} from "#send";

const RESEND_ENV = {
  [TRANSPORT_VARIABLE]: "resend",
  [API_KEY_VARIABLE]: "re_test",
  [FROM_VARIABLE]: "Recomencemos <hola@mail.recomencemos.co>",
  [REPLY_TO_VARIABLE]: "hola@recomencemos.co",
};

describe("transportName", () => {
  it.each(["resend", "terminal"])("accepts %s", (name) => {
    expect(transportName({ [TRANSPORT_VARIABLE]: name })).toBe(name);
  });

  it("is case-insensitive, because a value typed by hand is typed by hand", () => {
    expect(transportName({ [TRANSPORT_VARIABLE]: "Terminal" })).toBe("terminal");
  });

  /**
   * Unlike the kill switch, this variable has **no safe direction**. Defaulting
   * to `resend` mails a stranger from an unwarmed domain on a developer's first
   * loop; defaulting to `terminal` makes a production machine send nothing at
   * all. So it is required, and a typo stops the process.
   */
  it("refuses to be unset rather than picking a side", () => {
    expect(() => transportName({})).toThrow(AppError);
  });

  it("refuses an unrecognised value and names the valid ones", () => {
    const error = (() => {
      try {
        transportName({ [TRANSPORT_VARIABLE]: "smtp" });
      } catch (caught) {
        return caught as AppError;
      }
      return undefined;
    })();

    expect(error?.code).toBe("notifications_transport_unknown");
    expect(error?.message).toContain("resend, terminal");
  });
});

describe("createTransport", () => {
  it("builds the Resend transport when asked for one", () => {
    expect(createTransport(RESEND_ENV).name).toBe("resend");
  });

  it("builds the terminal transport when asked for one", () => {
    expect(
      createTransport({ [TRANSPORT_VARIABLE]: "terminal", NODE_ENV: "development" }).name,
    ).toBe("terminal");
  });

  /**
   * The assertion the development loop rests on. Not "the key is ignored" —
   * **the key is never asked for**, so an empty environment is a working one.
   */
  it("needs no credential and no sender identity for the terminal branch", () => {
    expect(() =>
      createTransport({ [TRANSPORT_VARIABLE]: "terminal", NODE_ENV: "development" }),
    ).not.toThrow();
  });

  it("still requires all three for the resend branch", () => {
    for (const missing of [API_KEY_VARIABLE, FROM_VARIABLE, REPLY_TO_VARIABLE]) {
      const env = { ...RESEND_ENV, [missing]: undefined };

      expect(() => createTransport(env), `${missing} must be required`).toThrow(AppError);
    }
  });

  // The environment record is the only input, so the guard inside the terminal
  // transport reads the same `NODE_ENV` the rest of the resolution does rather
  // than reaching past it into the process.
  it("refuses the terminal branch outside development and test", () => {
    expect(() =>
      createTransport({ [TRANSPORT_VARIABLE]: "terminal", NODE_ENV: "production" }),
    ).toThrow(AppError);
  });
});
