import { defineConfig } from "vitest/config";

// `@repo/errors`' config, which is the prior art for a Node package here:
// `resolve.tsconfigPaths` so the package's own `#`-prefixed imports resolve in a
// test the way they resolve in a build, `globals` with `vitest/globals` in the
// tsconfig's `types`, and the coverage block every workspace with tests carries.
//
// Node environment, no plugin, no setup file. Nothing in this package renders,
// and the one module that decodes an image does it in libvips rather than in a
// DOM — a happy-dom here would be a canvas nothing asks for.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // **`*.store.test.ts` needs a running bucket, so it is not in `pnpm test`.**
    // The glob above matches it — `photos.store.test.ts` ends in `.test.ts` —
    // so excluding it is a decision rather than an oversight, and getting this
    // wrong would put Docker on CI's critical path. CLAUDE.md is explicit that
    // `install`, `lint`, `check-types`, `test` and `build` all pass on a
    // machine with no Docker at all. `vitest.store.config.mts` is what runs
    // them, through `pnpm test:store`, after `pnpm db:up`.
    exclude: ["**/node_modules/**", "src/**/*.store.test.ts"],
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
