import { fileURLToPath } from "node:url";
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
//
// Neither project restates `resolve.tsconfigPaths`, and that is Vitest 5 rather
// than an omission: `extends` now defaults to `true` for an inline project, so
// the root's `resolve` block below reaches both. One setting is declared once
// instead of three times, which is three chances for the copies to disagree
// removed. (This package resolves its own modules through the `imports` field
// rather than tsconfig `paths`, so the inherited setting is carrying little
// here — but "declared once" is the property worth keeping either way.)
const shared = {
  globals: true,
} as const;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // **What lets a facade import `#connection` statically.** `server-only`
    // resolves to an empty module under the `react-server` condition and to a
    // bare `throw` under every other, and Vitest sets none — so before this
    // line, a static import of the connection module made the facade around it
    // unimportable at both seams, and every facade method opened by importing
    // it dynamically instead. This is the `moduleNameMapper` Next's own testing
    // docs prescribe for Jest, in Vite's spelling.
    //
    // It is declared here at the root rather than in either project, so both
    // inherit it — Vitest 5 defaults an inline project's `extends` to `true`.
    //
    // **It narrows what the test runner sees and nothing else.** The marker
    // stays on `connection.ts` and `health.ts`, where it is a build guarantee,
    // and `pnpm build` is what says so. The runtime backstop `#server-only` is
    // untouched and still fires on a `window`.
    alias: {
      "server-only": fileURLToPath(new URL("./src/testing/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Coverage is measured by v8 and reported, never enforced. The two
    // machine-readable reporters are the point: the pull-request comment is
    // built from `coverage-summary.json` and `coverage-final.json`, and
    // `text` is what a person reading a local run sees.
    //
    // **There is no `thresholds` key here, and that is the policy rather than
    // an omission.** A threshold fails the run, and `coverage-floor` in
    // `docs/policy/build.md` is answered `none`.
    //
    // **It sits above `projects` rather than inside either one**, which is what
    // makes seam 1 and seam 2 report one set of numbers instead of two that
    // overwrite each other in the same directory. A pure resolver covered by
    // seam 1 and a query module covered by seam 2 are the same package to a
    // reader of the report.
    //
    // `src/testing/**` is the harness the fixtures and the snapshot builder live
    // in, and the two CLI entry points are run as `node` by a Fly
    // `release_command` and by `pnpm admin:enrol` — none of the three is
    // product code a test is meant to reach.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/testing/**",
        "src/migrate/cli.ts",
        "src/admin/enrol-cli.ts",
      ],
    },
    projects: [
      {
        test: {
          ...shared,
          name: "seam-1",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
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
