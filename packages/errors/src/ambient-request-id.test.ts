import { AppError, MAX_REQUEST_ID_LENGTH } from "@repo/errors/app-error";
import { setAmbientRequestIdReader } from "@repo/errors/ambient-request-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requestIdOf(): string {
  return new AppError({ code: "probe", message: "probe" }).requestId;
}

afterEach(() => {
  setAmbientRequestIdReader(undefined);
});

describe("the ambient request id", () => {
  it("is absent by default, so an error mints its own", () => {
    expect(requestIdOf()).toMatch(UUID);
  });

  /**
   * The whole point: one identifier per request rather than one per error. Two
   * errors raised while handling the same request used to hand the user two
   * different reference numbers, and neither matched the id on the completion
   * line for that request.
   */
  it("is adopted when a server has registered one", () => {
    setAmbientRequestIdReader(() => "ambient-1");

    expect(requestIdOf()).toBe("ambient-1");
  });

  it("is the same for two errors raised in the same request", () => {
    setAmbientRequestIdReader(() => "ambient-1");

    expect(requestIdOf()).toBe(requestIdOf());
  });

  it("stops being adopted once the reader is cleared", () => {
    setAmbientRequestIdReader(() => "ambient-1");
    setAmbientRequestIdReader(undefined);

    expect(requestIdOf()).toMatch(UUID);
  });

  /**
   * A reader that has nothing to say — a background job, a module's import-time
   * failure — is the ordinary case outside a request, not an error. The error
   * mints its own, exactly as it did before any of this existed.
   */
  it("falls back to a fresh mint when the reader has no request to name", () => {
    setAmbientRequestIdReader(() => undefined);

    expect(requestIdOf()).toMatch(UUID);
  });
});

/**
 * Every case below is the reader misbehaving, and every one costs the *adoption*
 * rather than the error. This function runs on the one code path that exists to
 * report failure, so it may not become a second way for a request to fail.
 */
describe("a reader that cannot be trusted", () => {
  it("is ignored when it throws", () => {
    setAmbientRequestIdReader(() => {
      throw new Error("async context was lost after an await");
    });

    expect(requestIdOf()).toMatch(UUID);
  });

  it("is ignored when it returns something that is not a string", () => {
    setAmbientRequestIdReader(() => 7 as unknown as string);

    expect(requestIdOf()).toMatch(UUID);
  });

  it("is ignored when it returns an empty string, which correlates to nothing", () => {
    setAmbientRequestIdReader(() => "");

    expect(requestIdOf()).toMatch(UUID);
  });

  /**
   * The same bound the wire projection applies to the same field. An id past it
   * is one the browser would refuse, so adopting it would put a value on the log
   * line that no support ticket can ever quote back.
   */
  it("is ignored when it returns a value past the field's bound", () => {
    setAmbientRequestIdReader(() => "x".repeat(MAX_REQUEST_ID_LENGTH + 1));

    expect(requestIdOf()).toMatch(UUID);
  });

  it("accepts a value exactly at the bound", () => {
    const atBound = "x".repeat(MAX_REQUEST_ID_LENGTH);

    setAmbientRequestIdReader(() => atBound);

    expect(requestIdOf()).toBe(atBound);
  });
});
