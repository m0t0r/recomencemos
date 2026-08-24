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
  },
});
