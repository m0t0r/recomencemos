import { assertServerOnly } from "#server-only";

const scope = globalThis as { window?: unknown };

function inABrowser(body: () => void): void {
  scope.window = {};
  try {
    body();
  } finally {
    delete scope.window;
  }
}

describe("assertServerOnly", () => {
  it("passes on a server, where there is no window", () => {
    expect(() => assertServerOnly("connection")).not.toThrow();
  });

  it("names @repo/domain and the module, not the package it borrowed the idea from", () => {
    inABrowser(() => {
      expect(() => assertServerOnly("connection")).toThrow("@repo/domain/connection");
      expect(() => assertServerOnly("connection")).not.toThrow("@repo/observability");
    });
  });

  it("names the dependency that makes this package server-only", () => {
    // `pg` is a Node TCP client. A backstop that cannot say *why* leaves the
    // reader to guess whether the import was wrong or the rule is.
    inABrowser(() => {
      expect(() => assertServerOnly("connection")).toThrow("pg");
    });
  });

  it("points the caller at the boundary rather than at a workaround", () => {
    inABrowser(() => {
      expect(() => assertServerOnly("connection")).toThrow("Server Action");
    });
  });
});
