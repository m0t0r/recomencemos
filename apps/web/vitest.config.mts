import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `apps/web`'s Vitest config. It started as `packages/design-system`'s copied,
// and it is no longer one: the `pool` below is this suite's alone, and the two
// files are now expected to differ rather than to be kept in step. It was wired
// in the change that first put real code in the app rather than earlier — a
// suite here before then would have been vacuously green.
//
// **What this suite is not for.** Vitest cannot test `async` Server Components,
// and an imported Server Action is not the compiled POST endpoint an attacker
// reaches. Both of those verify at seam 3, against a running `next dev`. What
// lands here is what a running server cannot show: module resolution, Client
// Components, and the table-driven route assertions the spec describes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // **Four test files here reach a `@repo/domain` facade, and a facade now
    // imports the connection statically.** `server-only` resolves to a bare
    // `throw` under every condition Vitest sets, so without this line those four
    // fail at resolution — the same entry `packages/domain/vitest.config.mts`
    // carries, for the same reason.
    //
    // **It removes the marker layer in this suite and not the backstop.** A
    // `"use client"` module that pulled in `@repo/domain`, `@repo/observability`
    // or `@repo/notifications` still throws under happy-dom, because
    // `assertServerOnly` reads `window` and this alias does not touch it. What
    // the build guarantees is unchanged either way: the `exports` map is
    // mechanism 1, `domain-boundary.test.ts` asserts it through **Node's own
    // resolver**, and a Vite alias cannot reach that.
    //
    // A test that loads a server module also needs `@vitest-environment node`,
    // because the backstop above fires on a `window`. The four that do say so in
    // their own docblocks.
    alias: {
      "server-only": fileURLToPath(new URL("./testing/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    // **`vmThreads`, not the default `forks`, and this is the only suite in the
    // repo that gets it.** A DOM environment is constructed per test file; on
    // `forks` the reporter attributes ~37% of this suite's time to `environment`,
    // and the vm pool keeps per-file isolation while building one happy-dom per
    // *worker* instead — which is why that share falls to ~27% here rather than
    // staying put. Four runs of each on one developer machine: 1.8-1.9s against
    // 2.6-3.6s, 6196 tests passing either way and stable under `--repeats=3`.
    // Treat the ratio as the finding and the seconds as illustrative; both
    // moved by ~20% between a quiet machine and a busy one.
    //
    // **The saving is per-*file*, so it needs files to amortise over, and that
    // is the thing to measure before copying this line into a seventh suite.**
    // Two others were measured and refused: `@repo/design-system` spends the
    // same ~50% on its environment but has three files, and came out marginally
    // *slower* (500-530ms against 476-511ms); `@repo/domain` does reuse a module
    // graph — `import` falls from 13-15% to 4% — but 90%+ of its wall time is
    // the tests themselves, so the total vanished into noise on a second
    // measurement. The remaining three are Node-environment suites with no
    // environment to amortise, so the premise does not reach them at all.
    //
    // **The documented cost of a vm pool is cross-realm `instanceof`, and this
    // suite does contain some.** Five are `raw instanceof FormData` in the
    // `_lib/schema.ts` boundary parsers and one is the async-schema guard in
    // `testing/matchers.ts`. They are safe because both sides of each check are
    // evaluated inside the same VM context, not because the repo has none —
    // `@repo/errors` separately identifies an `AppError` through `Symbol.for`,
    // the global registry, which is realm-independent by construction. A new
    // `instanceof` against a value that crosses a realm boundary is the thing
    // this pool would break; `matchers.ts` is written against the thenable
    // contract for exactly that reason.
    pool: "vmThreads",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
    // Coverage is measured by v8 and reported, never enforced. The two
    // machine-readable reporters are the point: the pull-request comment is
    // built from `coverage-summary.json` and `coverage-final.json`, and
    // `text` is what a person reading a local run sees.
    //
    // **There is no `thresholds` key here, and that is the policy rather than
    // an omission.** A threshold fails the run, and `coverage-floor` in
    // `docs/policy/build.md` is answered `none`.
    //
    // **The number this produces is low by construction, and reading it as a gap
    // is the mistake.** The paragraph at the top of this file is the reason: a
    // route handler, a Server Action and an `async` Server Component are all
    // inside `app/` and none of them verifies here — they verify at seam 3
    // against a running `next dev`. So most of `app/` is uncovered *by design*,
    // which is exactly why `coverage-floor` is `none`: a floor would apply
    // pressure to close a gap that is a deliberate architecture.
    //
    // `testing/` is the suite's own harness and the boundary tests at the app
    // root are not source, so neither is measured.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "instrumentation*.ts"],
      exclude: ["**/*.test.{ts,tsx}"],
    },
  },
});
