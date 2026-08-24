import { defineConfig } from "vitest/config";

// Two settings and nothing else. `resolve.tsconfigPaths` makes the package's own
// self-referencing imports ("@repo/errors/app-error") resolve in a test the same
// way they resolve through the `exports` map in a build. `globals` puts
// `describe`/`it`/`expect` in scope, with `vitest/globals` in the tsconfig's
// `types` so `check-types` sees them too.
//
// Everything else is left at its default on purpose — Node environment, no
// React plugin, no setup file, no coverage gate. This is the first Node package
// with tests in the repo, so it is the prior art for the next one.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
