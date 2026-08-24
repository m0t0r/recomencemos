import { cleanup } from "@testing-library/react";

// React Testing Library registers its own cleanup when Vitest globals are on,
// which they are. Unmounting between tests is wired explicitly here anyway, so
// the guarantee is this repo's rather than a library's default that a future
// version could change.
afterEach(cleanup);
