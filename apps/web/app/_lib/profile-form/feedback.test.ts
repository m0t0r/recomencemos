import { PUBLISH_FAILED } from "./messages";
import { feedbackFor } from "./feedback";

describe("feedbackFor", () => {
  it("is nothing while nothing has happened", () => {
    expect(feedbackFor({}, PUBLISH_FAILED)).toBeUndefined();
  });

  it("is nothing for a field-level refusal, which the summary carries instead", () => {
    expect(
      feedbackFor({ validationErrors: { headline: { _errors: ["x"] } } }, PUBLISH_FAILED),
    ).toBeUndefined();
  });

  it("is nothing for a per-field refusal, which the summary carries instead", () => {
    expect(
      feedbackFor(
        {
          serverError: {
            code: "publish_refused",
            message: "x",
            requestId: "r",
            fieldErrors: { headline: { _errors: ["x"] } },
          },
        },
        PUBLISH_FAILED,
      ),
    ).toBeUndefined();
  });

  it("carries the ceiling's own sentence and its seconds", () => {
    const feedback = feedbackFor(
      {
        serverError: {
          code: "rate_limited",
          message: "Intentaste publicar 3 veces hoy, que es el máximo.",
          requestId: "r",
          retryAfter: 3600,
        },
      },
      PUBLISH_FAILED,
    );

    expect(feedback).toEqual({
      message: "Intentaste publicar 3 veces hoy, que es el máximo.",
      retryAfter: 3600,
    });
  });

  it("says the session sentence when the session is gone", () => {
    const feedback = feedbackFor(
      {
        serverError: {
          code: "session_required",
          message: "Tu sesión ya no está abierta.",
          requestId: "r",
        },
      },
      PUBLISH_FAILED,
    );

    expect(feedback?.message).toBe("Tu sesión ya no está abierta.");
  });

  it("says our sentence, not the transport's, on any other fault", () => {
    const feedback = feedbackFor(
      {
        serverError: { code: "internal_error", message: "Something went wrong", requestId: "r" },
      },
      PUBLISH_FAILED,
    );

    expect(feedback).toEqual({ message: PUBLISH_FAILED });
  });

  /**
   * The sentence is the caller's, which is the whole reason it became an
   * argument: a form that was saving a change to a profile must not tell her we
   * could not *publish* it. Naming an act she did not take is the failure the
   * voice guide's Don't 4 is about, and nothing else here would catch it.
   */
  it("says the caller's fault sentence, not publishing's", () => {
    const saveFailed = "No pudimos guardar tus cambios.";

    const feedback = feedbackFor(
      {
        serverError: { code: "internal_error", message: "Something went wrong", requestId: "r" },
      },
      saveFailed,
    );

    expect(feedback).toEqual({ message: saveFailed });
    expect(feedback?.message).not.toBe(PUBLISH_FAILED);
  });
});
