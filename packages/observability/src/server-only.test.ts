import { assertServerOnly } from "@repo/observability/server-only";

describe("assertServerOnly", () => {
  it("passes on a server, where there is no window", () => {
    expect(() => assertServerOnly("logger")).not.toThrow();
  });

  it("throws the moment a browser global exists, naming the module that was imported", () => {
    const scope = globalThis as { window?: unknown };
    scope.window = {};

    try {
      expect(() => assertServerOnly("logger")).toThrow("@repo/observability/logger");
      expect(() => assertServerOnly("logger")).toThrow("server-only");
    } finally {
      delete scope.window;
    }
  });

  it("points the caller at the package that is safe to import instead", () => {
    const scope = globalThis as { window?: unknown };
    scope.window = {};

    try {
      expect(() => assertServerOnly("logger")).toThrow("@repo/errors");
    } finally {
      delete scope.window;
    }
  });
});
