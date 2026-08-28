import { defineConfig } from "vitest/config";

// Seam 1 and seam 2 as two **projects** in one config (spec 0002,
// `## Testing Decisions`). They are the same kind of run — Node-environment
// Vitest over `src/**` — and differ in exactly one thing, which is now the only
// thing the config says about them: seam 2 needs the post-migration snapshot
// and seam 1 does not.
//
// **That difference used to cost seam 1 the snapshot anyway.** `globalSetup` is
// per-config, so a run touching only the pure resolvers still replayed every
// committed migration into PGlite and dumped a data directory before the first
// assertion. Naming the projects makes the setup apply to the files that need
// it, and makes `--project seam-1` a real thing to run while iterating on a pure
// function.
//
// The filename is the seam. `*.integration.test.ts` is seam 2 and everything else
// is seam 1 — the same convention the file layout already used, now enforced by
// the runner rather than by reading.
const shared = {
  globals: true,
} as const;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          ...shared,
          name: "seam-1",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          ...shared,
          name: "seam-2",
          include: ["src/**/*.integration.test.ts"],
          // Builds the post-migration snapshot once per run rather than once per
          // test file. See `src/testing/global-setup.ts`.
          globalSetup: ["./src/testing/global-setup.ts"],
        },
      },
    ],
  },
});
