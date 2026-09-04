/**
 * The single browser report site, driven through the window the deferred SDK
 * opens.
 *
 * **What is new here and what is not.** The digest guard and the no-client
 * guard are older than this suite and are covered because they are the two
 * things a change to the buffering could break without anyone noticing: both
 * decide whether an event is sent at all. The rest is the window itself — that
 * a boundary firing before the SDK arrives still gets its error reported, and
 * still, honestly, shows no reference.
 *
 * **`await import()` per case, for the reason the instrumentation suite gives.**
 * This module holds the reporter and the pending errors at module scope, so a
 * case that shares them with the one before it is testing the residue.
 */

// A plain `const` and not `vi.hoisted`: nothing mocks a module here, so there
// is no factory that would read this in its temporal dead zone. The SDK is
// handed to the module under test by hand, which is the whole point of the
// change these cases cover.
const sdk = {
  getClient: vi.fn(() => ({}) as never),
  captureException: vi.fn(() => "event-id"),
};

async function load() {
  vi.resetModules();
  vi.clearAllMocks();
  return await import("./report-client-error");
}

/** An error the way a boundary receives one, with or without the server's marker. */
function boundaryError(digest?: string) {
  return Object.assign(new Error("boom"), digest === undefined ? {} : { digest });
}

describe("an error thrown on the server", () => {
  it("is not reported again, and its digest is the reference", async () => {
    const { reportClientError, attachReporter } = await load();
    attachReporter(sdk);

    expect(reportClientError(boundaryError("abc123"))).toBe("abc123");
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("is reported when its digest is blank, which identifies nothing", async () => {
    const { reportClientError, attachReporter } = await load();
    attachReporter(sdk);

    expect(reportClientError(boundaryError("   "))).toBe("event-id");
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("an error thrown in the browser", () => {
  it("is reported, and its event id is the reference", async () => {
    const { reportClientError, attachReporter } = await load();
    attachReporter(sdk);
    const error = boundaryError();

    expect(reportClientError(error)).toBe("event-id");
    expect(sdk.captureException).toHaveBeenCalledWith(error);
  });

  it("shows no reference when the client sends nothing", async () => {
    const { reportClientError, attachReporter } = await load();
    sdk.getClient.mockReturnValueOnce(undefined as never);
    attachReporter(sdk);

    expect(reportClientError(boundaryError())).toBeUndefined();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  /**
   * A throw from here would be caught by the boundary above this one, which
   * replaces the error page with a worse error page.
   */
  it("never escapes, however the vendor fails", async () => {
    const { reportClientError, attachReporter } = await load();
    sdk.captureException.mockImplementationOnce(() => {
      throw new Error("the vendor is having a day");
    });
    attachReporter(sdk);

    expect(reportClientError(boundaryError())).toBeUndefined();
  });
});

describe("the window before the SDK arrives", () => {
  it("holds a boundary's error and replays it", async () => {
    const { reportClientError, attachReporter } = await load();
    const error = boundaryError();

    expect(reportClientError(error)).toBeUndefined();
    expect(sdk.captureException).not.toHaveBeenCalled();

    attachReporter(sdk);

    expect(sdk.captureException).toHaveBeenCalledWith(error, expect.anything());
  });

  it("holds what the window listeners hand it, in the same buffer", async () => {
    const { reportClientError, bufferThrown, attachReporter } = await load();
    const thrown = new Error("from a listener");
    const caught = boundaryError();

    bufferThrown(thrown);
    reportClientError(caught);
    attachReporter(sdk);

    expect(sdk.captureException).toHaveBeenCalledTimes(2);
  });

  it("stops at five however the errors arrive", async () => {
    const { reportClientError, bufferThrown, attachReporter } = await load();

    for (let i = 0; i < 10; i += 1) bufferThrown(new Error(`listener ${i}`));
    for (let i = 0; i < 10; i += 1) reportClientError(boundaryError());
    attachReporter(sdk);

    expect(sdk.captureException).toHaveBeenCalledTimes(5);
  });

  it("still reports nothing twice once the SDK is here", async () => {
    const { reportClientError, attachReporter } = await load();

    reportClientError(boundaryError());
    attachReporter(sdk);
    attachReporter(sdk);

    expect(sdk.captureException).toHaveBeenCalledTimes(1);
  });

  it("does not swallow a later report", async () => {
    const { reportClientError, attachReporter } = await load();

    reportClientError(boundaryError());
    attachReporter(sdk);

    expect(reportClientError(boundaryError())).toBe("event-id");
    expect(sdk.captureException).toHaveBeenCalledTimes(2);
  });
});
