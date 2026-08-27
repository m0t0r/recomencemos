import { AppError } from "@repo/errors/app-error";
import {
  API_KEY_VARIABLE,
  FROM_VARIABLE,
  KILL_SWITCH_VARIABLE,
  REPLY_TO_VARIABLE,
  resendApiKey,
  sendingIsKilled,
  senderIdentity,
} from "#config";

describe("sendingIsKilled", () => {
  // The table is the design. A kill switch is read once in an incident, by
  // someone who is not going to check the source for which spellings count.
  const cases: ReadonlyArray<readonly [string, string | undefined, boolean]> = [
    ["unset", undefined, false],
    ["empty", "", false],
    ["whitespace", "   ", false],
    ["off", "off", false],
    ["false", "false", false],
    ["0", "0", false],
    ["no", "no", false],
    ["OFF, in caps", "OFF", false],
    ["on", "on", true],
    ["true", "true", true],
    ["1", "1", true],
    ["yes", "yes", true],
  ];

  for (const [name, value, killed] of cases) {
    it(`${killed ? "engages" : "leaves sending on"} for ${name}`, () => {
      expect(sendingIsKilled({ [KILL_SWITCH_VARIABLE]: value })).toBe(killed);
    });
  }

  // The one that matters, and the reason the disengaging values are a whitelist
  // rather than the engaging ones. An operator who reaches for a spelling this
  // repo did not anticipate gets a refusal, not a delivery.
  it("engages on an unrecognised value, so a typo fails toward not sending", () => {
    expect(sendingIsKilled({ [KILL_SWITCH_VARIABLE]: "onn" })).toBe(true);
    expect(sendingIsKilled({ [KILL_SWITCH_VARIABLE]: "disabled" })).toBe(true);
  });

  it("reads its own variable and nothing else", () => {
    expect(sendingIsKilled({ NOTIFICATIONS_ENABLED: "false" })).toBe(false);
  });
});

describe("resendApiKey", () => {
  it("returns the key when it is set", () => {
    expect(resendApiKey({ [API_KEY_VARIABLE]: "re_test" })).toBe("re_test");
  });

  it("throws an AppError naming the variable when it is not", () => {
    try {
      resendApiKey({});
      expect.unreachable("an unset key must not resolve");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("notifications_config_missing");
      expect(appError.context).toMatchObject({ variable: API_KEY_VARIABLE });
    }
  });

  // The credential is the one value that must not reach the error. `redaction.ts`
  // matches key *names*, so a key interpolated into `message` is a secret at a
  // key nothing is watching.
  it("never puts the key itself in the error", () => {
    try {
      resendApiKey({ [API_KEY_VARIABLE]: "   " });
      expect.unreachable("a whitespace-only key must not resolve");
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("re_");
    }
  });
});

describe("senderIdentity", () => {
  it("returns both halves when both are set", () => {
    expect(
      senderIdentity({
        [FROM_VARIABLE]: "Recomencemos <hola@mail.recomencemos.co>",
        [REPLY_TO_VARIABLE]: "hola@recomencemos.co",
      }),
    ).toEqual({
      from: "Recomencemos <hola@mail.recomencemos.co>",
      replyTo: "hola@recomencemos.co",
    });
  });

  // DD14 makes the reply-to a product commitment rather than a config line: a
  // woman replying to an Offer notification must reach a person. A default here
  // would be the `noreply@` that decision refuses, arrived at by accident.
  it("refuses to default the reply-to", () => {
    expect(() => senderIdentity({ [FROM_VARIABLE]: "hola@mail.recomencemos.co" })).toThrow(
      AppError,
    );
  });

  it("refuses to default the from address", () => {
    expect(() => senderIdentity({ [REPLY_TO_VARIABLE]: "hola@recomencemos.co" })).toThrow(AppError);
  });
});
