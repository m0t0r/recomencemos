import { defineConfig } from "vitest/config";

// `@repo/errors`' config, plus `.tsx` in the include glob and nothing else.
//
// No React plugin: the plugin exists for Fast Refresh and a DOM environment,
// and this package has neither — a template is rendered to a *string* by
// `@react-email/render`, in Node. Vite's own esbuild transform reads `jsx:
// "react-jsx"` out of the tsconfig, which is the whole of what a `.tsx` file
// here needs.
//
// Environment stays Node for the same reason. A template test that reached for
// happy-dom would be asserting against a DOM that no email client has.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
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
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
    },
  },
});
