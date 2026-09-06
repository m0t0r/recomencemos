import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `resolve.tsconfigPaths` is what makes the package's own self-referencing
// imports ("@repo/design-system/lib/utils") resolve in a test the same way they
// resolve in a build. Without it every test would have to import by relative
// path and stop matching the code it covers. Vite resolves them natively, so the
// `vite-tsconfig-paths` plugin Next's docs still prescribe is not needed here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
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
      exclude: ["src/**/*.test.{ts,tsx}", "src/styles/**"],
    },
  },
});
