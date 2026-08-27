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
  },
});
