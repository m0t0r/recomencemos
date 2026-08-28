import { cleanup } from "@testing-library/react";

// Custom matchers, registered for every file in this suite. A side-effect import
// is the shape a matcher module has to have — `expect.extend` runs at module
// scope and there is nothing to bind — so the rule is disabled here, with a
// reason, rather than `**/testing/**` being added to the repo-wide allowlist.
// oxlint-disable-next-line import/no-unassigned-import
import "./testing/matchers";

// React Testing Library registers its own cleanup when Vitest globals are on,
// which they are. Unmounting between tests is wired explicitly here anyway, so
// the guarantee is this repo's rather than a library's default that a future
// version could change.
afterEach(cleanup);
