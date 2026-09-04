/**
 * The browser instrumentation entry point, driven rather than read.
 *
 * **Why a suite at all, when the neighbours here are source sweeps.** The three
 * boundary tests beside this file assert things about *text* because what they
 * check is a build artefact a Vitest run does not have. This one is different:
 * everything that makes the deferral correct is behaviour a module can be made
 * to perform — that `init` has not run yet, that it runs once the page goes
 * idle, that the errors thrown in between are not lost, that the framework's
 * synchronous export exists before the SDK does. A grep for `await import(`
 * would pass on every broken version of that.
 *
 * **The window is controlled, not waited out.** `requestIdleCallback` is stubbed
 * so the test decides when the SDK arrives, which is what makes "before" and
 * "after" two states rather than a race.
 *
 * **`await import()` is deliberate here and is not the shape `CLAUDE.md` warns
 * about.** That warning is about reaching for a dynamic import to escape a
 * `vi.hoisted` temporal dead zone. The reason here is that this module's whole
 * subject is a top-level side effect: each case needs it evaluated afresh, with
 * a different environment and a different idle stub in place before the first
 * line of it runs. The doubles are still `vi.hoisted`, and the mock is still
 * lifted above everything.
 */

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sdk);

const DSN = "https://examplekey@o0.ingest.example.test/0";

/**
 * Evaluate the entry point with a chosen environment, and hand back the two
 * separate things a case needs: the lever that lets the page go idle, and the
 * wait for the SDK that follows it.
 *
 * **They are two rather than one because half the cases are about the SDK
 * *not* arriving.** A single `arrive()` that pulled the lever and then waited
 * on `init` would, on the no-DSN path, wait a second for something that must
 * never happen and then reject into nobody's hands — a case that passes only
 * while the file finishes before the timeout does.
 */
async function evaluate({ dsn }: { dsn?: string } = {}) {
  vi.resetModules();
  vi.clearAllMocks();

  if (dsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;

  let idle: (() => void) | undefined;
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
    idle = callback;
    return 1;
  });

  const entry = await import("./instrumentation-client");

  // Imported *after* the reset, so it is the same instance the entry point got.
  // `vi.resetModules()` gives the module under test a fresh registry, and a
  // `scrubOrDrop` this file imported at its own top level would be a different
  // function object that the identity assertion below would fail on — while the
  // three hooks were wired perfectly.
  const { scrubOrDrop } = await import("@repo/errors/redaction");

  // The module takes one of two paths depending on `document.readyState` at the
  // moment it evaluates, and both end at the same idle callback. Dispatching
  // `load` unconditionally covers the path this environment did not take and is
  // inert on the path it did.
  window.dispatchEvent(new Event("load"));

  return {
    entry,
    scrubOrDrop,

    /** The page goes idle. Whether anything happens next is the case's claim. */
    goIdle() {
      idle?.();
    },

    /** The page goes idle *and* the SDK turns up, which is the common case. */
    async arrive() {
      idle?.();
      // The load is a real dynamic import of the mocked module, so it resolves a
      // microtask later rather than synchronously.
      await vi.waitFor(() => expect(sdk.init).toHaveBeenCalled());
    },
  };
}

/**
 * Let every queued microtask and timer run.
 *
 * Used where a case asserts that something did *not* happen: without it the
 * assertion is only that it had not happened yet, which is true a tick after
 * every version of this module, working or broken.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** An `error` event carrying a thrown value, the way a browser delivers one. */
function throwsAt(window: Window, error: unknown) {
  const event = new Event("error");
  Object.assign(event, { error, message: String(error) });
  window.dispatchEvent(event);
}

function rejectsWith(window: Window, reason: unknown) {
  const event = new Event("unhandledrejection");
  Object.assign(event, { reason });
  window.dispatchEvent(event);
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

describe("the SDK arrives after the page", () => {
  it("has not initialised by the time the module has evaluated", async () => {
    await evaluate({ dsn: DSN });

    expect(sdk.init).not.toHaveBeenCalled();
  });

  it("initialises once the page goes idle", async () => {
    const { arrive } = await evaluate({ dsn: DSN });

    await arrive();

    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it("initialises nothing at all without a DSN", async () => {
    const { goIdle } = await evaluate({});

    goIdle();
    await flush();

    expect(sdk.init).not.toHaveBeenCalled();
  });
});

describe("nothing about redaction weakens", () => {
  it("wires the same scrubber to all three egresses", async () => {
    const { arrive, scrubOrDrop } = await evaluate({ dsn: DSN });

    await arrive();

    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: scrubOrDrop,
        beforeSendTransaction: scrubOrDrop,
        beforeBreadcrumb: scrubOrDrop,
      }),
    );
  });

  it("still refuses to send the request's own identifying fields", async () => {
    const { arrive } = await evaluate({ dsn: DSN });

    await arrive();

    expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false }));
  });
});

describe("what is thrown before the SDK arrives", () => {
  it("is replayed once it is here", async () => {
    const { arrive } = await evaluate({ dsn: DSN });
    const boom = new Error("boom");

    throwsAt(window, boom);
    await arrive();

    expect(sdk.captureException).toHaveBeenCalledWith(boom, expect.anything());
  });

  it("includes a rejection nobody handled", async () => {
    const { arrive } = await evaluate({ dsn: DSN });
    const boom = new Error("rejected");

    rejectsWith(window, boom);
    await arrive();

    expect(sdk.captureException).toHaveBeenCalledWith(boom, expect.anything());
  });

  it("stops at five, so a loop cannot spend a month of events", async () => {
    const { arrive } = await evaluate({ dsn: DSN });

    for (let i = 0; i < 20; i += 1) throwsAt(window, new Error(`boom ${i}`));
    await arrive();

    expect(sdk.captureException).toHaveBeenCalledTimes(5);
  });

  it("is not buffered where there is nothing to replay into", async () => {
    const { goIdle } = await evaluate({});

    throwsAt(window, new Error("boom"));
    goIdle();
    await flush();

    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});

describe("what is thrown after the SDK arrives", () => {
  /**
   * The SDK installs global handlers of its own on `init`. A listener of ours
   * that outlived it would hold a second copy of every later error, and the
   * event budget is the thing that pays for that.
   */
  it("is left entirely to the SDK's own handlers", async () => {
    const { arrive } = await evaluate({ dsn: DSN });

    await arrive();
    throwsAt(window, new Error("after"));
    rejectsWith(window, new Error("after"));
    await flush();

    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});

describe("the navigation hook the framework calls", () => {
  it("exists, and says nothing, before the SDK does", async () => {
    const { entry } = await evaluate({ dsn: DSN });

    expect(() => entry.onRouterTransitionStart("/profiles", "push")).not.toThrow();
    expect(sdk.captureRouterTransitionStart).not.toHaveBeenCalled();
  });

  it("forwards the navigation once the SDK is here", async () => {
    const { entry, arrive } = await evaluate({ dsn: DSN });

    await arrive();
    entry.onRouterTransitionStart("/profiles", "push");

    expect(sdk.captureRouterTransitionStart).toHaveBeenCalledWith("/profiles", "push");
  });

  it("stays a no-op for the life of a page with no DSN", async () => {
    const { entry } = await evaluate({});

    entry.onRouterTransitionStart("/profiles", "push");

    expect(sdk.captureRouterTransitionStart).not.toHaveBeenCalled();
  });
});
