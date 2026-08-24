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
  },
});
