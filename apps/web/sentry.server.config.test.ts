/**
 * @vitest-environment node
 *
 * The server reporting configuration, driven rather than read.
 *
 * **Why this is a suite and not a source sweep.** Three of the boundary tests
 * beside this file assert on *text*, because what they check is a build artefact
 * a Vitest run does not have. This is the shape `instrumentation-client.test.ts`
 * uses instead, and for the same reason: everything asserted here is behaviour a
 * module can be made to perform. The entry point's whole job is one top-level
 * side effect — a call to `init` — so evaluating it with a double in place hands
 * back exactly the options the SDK would have received. A grep for
 * `beforeSendLog` would pass on every broken version of that, including one that
 * wired it to the wrong function.
 *
 * The second half of the file drives the **real** integration rather than the
 * double, because the question there is not what this repo declares but what the
 * installed SDK does with it. That is the half a dependency bump can silently
 * reopen, so it is pinned against the vendor's own code.
 *
 * The node environment is deliberate: this loads server SDK code, and the
 * package's runtime backstop fires on a `window`.
 */

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  pinoIntegration: vi.fn(() => ({ name: "Pino" })),
  requestDataIntegration: vi.fn((options: unknown) => ({ name: "RequestData", options })),
}));

vi.mock("@sentry/nextjs", () => sdk);

/**
 * `process.env` is worker-wide, and this suite runs on `vmThreads` — so a
 * variable left set here is one the next file in the same worker inherits. The
 * neighbouring instrumentation suite clears the same key for the same reason.
 */
afterEach(() => {
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

/**
 * The options the entry point hands `init`, with the module evaluated afresh —
 * and the scrubber **from that same evaluation**.
 *
 * The second return value is not a convenience. `resetModules` gives the config
 * module a fresh copy of every module it imports, so a `scrubOrDrop` imported at
 * the top of this file is a different function object from the one the config
 * just wired up. Comparing against it fails with two identical-looking functions
 * and no visual difference — which is a confusing way to learn that the identity
 * assertion was never testing what it looked like it was testing.
 */
async function initOptions(): Promise<{
  options: Record<string, unknown>;
  scrubOrDrop: unknown;
}> {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://examplekey@o0.ingest.example.test/0";

  await import("./sentry.server.config");
  const { scrubOrDrop } = await import("@repo/errors/redaction");

  const call = sdk.init.mock.calls[0];
  if (!call) throw new Error("the entry point was evaluated and did not initialise the SDK");

  return { options: call[0] as Record<string, unknown>, scrubOrDrop };
}

describe("every egress reaches the scrubber", () => {
  /**
   * A log envelope is not an event. It routes through its own hook and reaches
   * none of the other three, so with logs enabled and this hook unset, every
   * forwarded line — the request-completion line included — went to the vendor
   * with nothing in front of it.
   */
  it("scrubs log envelopes, which reach their own hook and not beforeSend", async () => {
    const { options, scrubOrDrop } = await initOptions();

    expect(options.beforeSendLog).toBe(scrubOrDrop);
  });

  /**
   * One function across all four, which is what stops them drifting apart. The
   * identity comparison is the point: a second scrubber wired to one hook would
   * satisfy any assertion that merely checked each was a function.
   */
  it("uses one scrubber for all four hooks rather than four that can disagree", async () => {
    const { options, scrubOrDrop } = await initOptions();

    expect(options.beforeSend).toBe(scrubOrDrop);
    expect(options.beforeSendTransaction).toBe(scrubOrDrop);
    expect(options.beforeBreadcrumb).toBe(scrubOrDrop);
    expect(options.beforeSendLog).toBe(scrubOrDrop);
  });

  it("keeps logs enabled, since the hook above is otherwise answering nothing", async () => {
    const { options } = await initOptions();

    expect(options.enableLogs).toBe(true);
  });
});

describe("what the server never collects in the first place", () => {
  it("declares the request-data integration with cookies and headers off", async () => {
    await initOptions();

    expect(sdk.requestDataIntegration).toHaveBeenCalledWith({
      include: { cookies: false, headers: false },
    });
  });

  /**
   * The flag is pinned for what it genuinely still withholds — the IP address,
   * request bodies, generative-AI inputs and outputs, and database query data.
   * It is emphatically **not** what withholds cookies and headers, which is what
   * the integration above is for; the comment in the config carries the reading
   * of the SDK that establishes this.
   */
  it("still pins the flag that withholds the IP address and request bodies", async () => {
    const { options } = await initOptions();

    expect(options.sendDefaultPii).toBe(false);
  });
});

/**
 * The vendor's half of the contract.
 *
 * Everything above proves what this repo *asks* for. This proves the ask has the
 * effect claimed — against the installed SDK, using the genuine integration, so
 * that a version which stops honouring `include` comes back red here rather than
 * silently reopening the hole the rest of this change closes.
 */
describe("the installed SDK honours what the integration is asked for", () => {
  const NORMALIZED_REQUEST = {
    method: "GET",
    url: "https://recomencemos.test/wall",
    headers: {
      cookie: "__Secure-better-auth.session_token=PLACEHOLDER_SESSION_VALUE",
      referer: "https://recomencemos.test/",
      "user-agent": "PlaceholderAgent/1.0",
    },
  };

  /**
   * A **real** client, at the `sendDefaultPii: false` this app runs at, rather
   * than a stub.
   *
   * The integration asks the client to resolve that flag into a collection
   * object, and the whole finding turned on what that resolution produces — the
   * `false` branch yields `cookies: { deny: … }`, an object rather than `false`,
   * which is why the cookie map was written at all. A stub would have to restate
   * that mapping, and a restated mapping is one that can drift from the vendor
   * silently: the day the SDK changes it, the stub would keep this test green
   * while the real hole reopened.
   *
   * No DSN, so the client is inert and sends nothing; `defaultIntegrations:
   * false` keeps `init` from installing anything that would reach outside this
   * process.
   */
  async function processEvent(options: unknown) {
    const actual = await vi.importActual<typeof import("@sentry/nextjs")>("@sentry/nextjs");

    actual.init({ dsn: undefined, sendDefaultPii: false, defaultIntegrations: false });
    const client = actual.getClient();
    if (!client)
      throw new Error("no client was created, so nothing resolved the collection options");

    const integration = actual.requestDataIntegration(
      options as Parameters<typeof actual.requestDataIntegration>[0],
    );

    const event = { sdkProcessingMetadata: { normalizedRequest: NORMALIZED_REQUEST } };

    return integration.processEvent?.(event as never, {} as never, client) as unknown as {
      request?: Record<string, unknown>;
    };
  }

  it("assembles neither the cookie map nor the header dict when both are excluded", async () => {
    const processed = await processEvent({ include: { cookies: false, headers: false } });

    expect(processed.request?.cookies).toBeUndefined();
    expect(processed.request?.headers).toBeUndefined();
    // Scoped to `request` on purpose. The raw request stays on
    // `sdkProcessingMetadata`, which is the integration's *input* and is dropped
    // before an envelope is built — asserting over the whole event here would be
    // asserting about a field that never ships.
    expect(JSON.stringify(processed.request)).not.toContain("PLACEHOLDER_SESSION_VALUE");
  });

  it("keeps the method and the URL, which are what an event is triaged by", async () => {
    const processed = await processEvent({ include: { cookies: false, headers: false } });

    expect(processed.request?.method).toBe("GET");
    expect(processed.request?.url).toBe("https://recomencemos.test/wall");
  });

  /**
   * The state this change moved away from, asserted so the fix is not mistaken
   * for a no-op. Left to the defaults the SDK writes the parsed cookie map onto
   * the event even at `sendDefaultPii: false` — because that flag resolves
   * `cookies` to an object rather than to `false`, and the deny list that object
   * carries never runs on the event path.
   */
  it("assembles the cookie map by default, which is the hole this closes", async () => {
    const processed = await processEvent(undefined);

    expect(processed.request?.cookies).toBeDefined();
    expect(JSON.stringify(processed.request)).toContain("PLACEHOLDER_SESSION_VALUE");
  });
});
