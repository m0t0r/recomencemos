import { defineConfig } from "vitest/config";

// Seam 1 and seam 2 in one config, because they differ in what they reach for
// and not in how they run: both are Node-environment Vitest over `src/**`, and
// splitting them into two configs would buy a distinction the file layout
// already makes.
//
// The shape is `@repo/errors`' — `resolve.tsconfigPaths`, `globals`, an
// `include` glob — plus the one thing that package had no need of:
// `globalSetup`, which builds seam 2's post-migration snapshot **once per run**
// rather than once per test file. See `src/testing/global-setup.ts`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/testing/global-setup.ts"],
  },
});
