import { defineConfig } from "vitest/config";

// Two settings and nothing else. `resolve.tsconfigPaths` makes the package's own
// self-referencing imports ("@repo/errors/app-error") resolve in a test the same
// way they resolve through the `exports` map in a build. `globals` puts
// `describe`/`it`/`expect` in scope, with `vitest/globals` in the tsconfig's
// `types` so `check-types` sees them too.
//
// Everything else is left at its default on purpose — Node environment, no
// React plugin, no setup file. This is the first Node package with tests in the
// repo, so it is the prior art for the next one, and that now includes the
// `coverage` block: every workspace with tests carries the same one.
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
