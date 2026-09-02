import { PUBLISH_FAILED } from "./messages";
import { feedbackFor } from "./feedback";

describe("feedbackFor", () => {
  it("is nothing while nothing has happened", () => {
    expect(feedbackFor({})).toBeUndefined();
  });

  it("is nothing for a field-level refusal, which the summary carries instead", () => {
    expect(feedbackFor({ validationErrors: { headline: { _errors: ["x"] } } })).toBeUndefined();
  });

  it("is nothing for a per-field refusal, which the summary carries instead", () => {
    expect(
      feedbackFor({
        serverError: {
          code: "publish_refused",
          message: "x",
          requestId: "r",
          fieldErrors: { headline: { _errors: ["x"] } },
        },
      }),
    ).toBeUndefined();
  });

  it("carries the ceiling's own sentence and its seconds", () => {
    const feedback = feedbackFor({
      serverError: {
        code: "rate_limited",
        message: "Intentaste publicar 3 veces hoy, que es el máximo.",
        requestId: "r",
        retryAfter: 3600,
      },
    });

    expect(feedback).toEqual({
      message: "Intentaste publicar 3 veces hoy, que es el máximo.",
      retryAfter: 3600,
    });
  });

  it("says the session sentence when the session is gone", () => {
    const feedback = feedbackFor({
      serverError: {
        code: "session_required",
        message: "Tu sesión ya no está abierta.",
        requestId: "r",
      },
    });

    expect(feedback?.message).toBe("Tu sesión ya no está abierta.");
  });

  it("says our sentence, not the transport's, on any other fault", () => {
    const feedback = feedbackFor({
      serverError: { code: "internal_error", message: "Something went wrong", requestId: "r" },
    });

    expect(feedback).toEqual({ message: PUBLISH_FAILED });
  });
});
