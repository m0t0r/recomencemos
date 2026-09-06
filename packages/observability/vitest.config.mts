import { defineConfig } from "vitest/config";

// The same two settings `@repo/errors` carries, for the same reasons: the spec
// names that package as the prior art for a Node package's test config here, and
// a second shape would make the next one a coin flip.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // Coverage is measured by v8 and reported, never enforced. The two
    // machine-readable reporters are the point: the pull-request comment is
    // built from `coverage-summary.json` and `coverage-final.json`, and
    // `text` is what a person reading a local run sees.
    //
    // **There is no `thresholds` key here, and that is the policy rather than
    // an omission.** A threshold fails the run, and `coverage-floor` in
    // `docs/policy/build.md` is answered `none`.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
