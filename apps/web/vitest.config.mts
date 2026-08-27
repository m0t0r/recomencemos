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
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
