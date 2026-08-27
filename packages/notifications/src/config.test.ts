import { AppError } from "@repo/errors/app-error";
import {
  API_KEY_VARIABLE,
  FROM_VARIABLE,
  KILL_SWITCH_VARIABLE,
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
  it("returns the from address when it is set", () => {
    expect(
      senderIdentity({ [FROM_VARIABLE]: "Recomencemos <hola@mail.recomencemos.online>" }),
    ).toEqual({ from: "Recomencemos <hola@mail.recomencemos.online>" });
  });

  it("refuses to default the from address", () => {
    expect(() => senderIdentity({})).toThrow(AppError);
  });

  /**
   * **The amendment, asserted.** DD14 required a monitored `Reply-To` and this
   * function resolved one. The sending subdomain is send-only in Resend — no MX,
   * no mailbox — so the header would have named an address that receives
   * nothing. It was removed rather than pointed somewhere plausible, and this
   * case is what stops it drifting back in as a defaulted or optional field: the
   * identity has exactly one key.
   */
  it("carries no reply-to, because nothing receives one", () => {
    const identity = senderIdentity({
      [FROM_VARIABLE]: "Recomencemos <hola@mail.recomencemos.online>",
      NOTIFICATIONS_REPLY_TO: "hola@recomencemos.online",
    });

    expect(Object.keys(identity)).toEqual(["from"]);
  });
});
