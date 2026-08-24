import { createDestination, logger } from "@repo/observability/logger";

describe("the singleton", () => {
  it("is a logger", () => {
    expect(typeof logger.info).toBe("function");
  });
});

describe("the destination (the format switch selects one, never a transport)", () => {
  it("is a writable stream in json mode", () => {
    expect(typeof createDestination({ NODE_ENV: "production" }).write).toBe("function");
  });

  it("constructs the pretty printer as a stream, so no worker thread exists", () => {
    const destination = createDestination({ NODE_ENV: "development" });

    expect(typeof destination.write).toBe("function");
    // `thread-stream` — what `transport: { target }` would build — exposes the
    // worker it owns. A destination stream has none, which is the structural
    // answer the spec asked for rather than a promise in a comment.
    expect(destination).not.toHaveProperty("worker");
  });
});
