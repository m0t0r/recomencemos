import { defineConfig } from "vitest/config";

/**
 * The checks that need a **real S3 bucket**, and therefore a second config.
 *
 * `pnpm test:store`, after `pnpm db:up`. Never `pnpm test`, and never CI: NFR6
 * is true because a bucket policy refuses, so the one thing worth asserting
 * here cannot be asserted anywhere a bucket does not exist — and the price of
 * that is Docker, which CLAUDE.md keeps off the critical path of `install`,
 * `lint`, `check-types`, `test` and `build` deliberately.
 *
 * A second config rather than a Vitest project, unlike `@repo/domain`'s two
 * seams: projects live in one config and run together by default, and running
 * together by default is the exact thing this must not do.
 *
 * No `coverage` block — these run on demand and are not part of the number a
 * pull request reports, so a partial run must not be able to move it.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.store.test.ts"],
    // The bucket is one machine-wide instance shared with every worktree, and
    // these tests mint their own keys but do read a prefix policy. One file at
    // a time keeps a failure readable rather than interleaved.
    fileParallelism: false,
    // A presign, a PUT, a libvips decode and four HTTP round trips per case.
    testTimeout: 30_000,
  },
});
