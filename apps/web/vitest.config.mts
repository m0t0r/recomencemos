import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// `apps/web`'s first Vitest config, copied from
// `packages/design-system/vitest.config.mts` as `CLAUDE.md` prescribes, and
// wired in the change that first puts real code in the app rather than earlier —
// a suite here before then would have been vacuously green.
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
  },
  test: {
    globals: true,
    environment: "happy-dom",
    // **`vmThreads`, not the default `forks`, and this is the only suite in the
    // repo that gets it.** A DOM environment is constructed per test file and
    // the reporter puts that at ~37% of this suite's wall time; a vm pool keeps
    // per-file isolation but builds one happy-dom per *worker* instead. Over
    // four runs of each, under load: 1.81-1.94s here against 2.56-3.57s on
    // `forks`, with 6196 tests passing either way.
    //
    // **The other five suites measured no win, and the reason is the one that
    // matters if a sixth is ever added: the saving is per-*file*, so it needs
    // files to amortise over.** `@repo/design-system` has three and came out
    // marginally *slower* (500-530ms against 476-511ms) despite spending the
    // same ~50% on its environment; `@repo/domain`'s gain was real in the
    // module graph — `import` fell from 13-15% to 4% — but its wall time is
    // 90%+ the tests themselves, so it vanished into machine noise on a second
    // measurement. Both are on `forks`. Measure before copying this line.
    //
    // The documented cost of a vm pool is cross-realm `instanceof`. It does not
    // reach this repo by accident — `@repo/errors` identifies an `AppError`
    // through `Symbol.for`, the *global* registry, which is shared across
    // realms, and `app-error.ts` argues for that on its own terms.
    pool: "vmThreads",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
