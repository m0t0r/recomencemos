# Vitest Browser Mode

This repository's DOM tests run under **happy-dom with React Testing Library**. They do not run in a real browser through Vitest Browser Mode and `vitest-browser-react`, and moving them there was measured and declined.

## What it would have been

Vitest Browser Mode runs a test file in a real browser (Chromium, through Playwright) instead of a simulated DOM. `vitest-browser-react` replaces Testing Library: `render` is awaited, queries live on `page` from `vitest/browser`, and `await expect.element(locator)` retries the way a Playwright locator does, so `getBy`/`findBy`/`queryBy`, `waitFor` and `act` all go away. The jest-dom matchers are built in. It has been stable since Vitest 4.

```tsx
await render(<CopyCodes codes={CODES} />);
await page.getByRole("button", { name: COPY_CODES }).click();
await expect.element(page.getByRole("status")).toHaveTextContent(COPY_CODES_DONE);
await expect(navigator.clipboard.readText()).resolves.toBe("ABCD-EFGH\n2345-JKLM\nNPQR-STUV");
```

## Why this is out of scope

**It makes every pull request slower, and what it catches is caught already.** A spike on 2026-09-15 measured it, using `vitest` 5.0.0, `@vitest/browser-playwright` 5.0.0, `vitest-browser-react` 2.3.0 and Playwright 1.63.0 on one developer machine:

|                                                    | happy-dom, today | Browser Mode, warm cache  |
| -------------------------------------------------- | ---------------- | ------------------------- |
| `apps/web`, the `app/` + `lib/` + `testing/` files | 58 files, 2.47s  | 55 files, 9.04s and 9.47s |
| `packages/design-system`                           | 3 files, 0.50s   | 4 files, 1.97s            |

That is about 3.6 times the wall time locally. In CI:

- `test` is already the slowest job, at 166 to 183 seconds on the last three runs against about 60 for `build`. The jobs run in parallel, so it is the one every pull request waits on.
- Browser Mode adds a Chromium install with its OS packages to that job on every run, and Playwright advises against caching the binaries. The headless shell alone is a 94 MiB download. The install was estimated at 30 to 60 seconds, not measured in CI.
- A cold Vite cache, which is what CI always starts with, re-bundles dependencies mid-run unless `optimizeDeps.include` lists every one of them. That list has to include the server graph behind the mocked `"use server"` modules. A run that re-bundles loads React twice and fails files that have nothing to do with it.

The repository is public, so the Actions minutes cost no money. The cost is the wait on every pull request, estimated at 25 to 40 percent more.

**The gain did not justify it.** Unmodified, 50 of the 55 files passed in Chromium. A 56th, a copy suite that reaches `node:crypto`, had already been set aside because it could never run in a browser. The five failures split three ways:

- **Some were Node-bound and could never move.** `sign-in-link` and half of `session-menu` read source files with `node:fs`. `report-client-error` resets module state with `vi.resetModules()` between cases, and that state leaked between cases in the browser.
- **Two were tests happy-dom lets pass wrongly.**
  - The Offer form's refused-submit cases click a button inside a closed `<details>`.
  - The session menu is opened with a synthetic click that Base UI ignores in a real browser.

  `packages/design-system/CLAUDE.md` names both, so neither is read as evidence of real-browser behaviour.

- **One was Testing Library itself.** Run inside Chromium, it computes an `sr-only` accessible name as "Copiarnombre". Chrome's own accessibility tree and Vitest's locator engine both say "Copiar nombre", and so does Testing Library under happy-dom. That is an argument about how to migrate, not a problem with today's suite.
- **None was a product bug.** In each case the component was right and the test was wrong.

**And real-browser behaviour already has a seam.** Every change to `apps/web` verifies against a running `next dev` through `next-dev-loop`, and every visible change carries recorded proof through `ui-proof`. Both are real Chromium, driving the compiled app a person uses. Browser Mode would sit beside them as a second real-browser check on every pull request, and a narrower one: it renders a component in isolation, and it cannot render an `async` Server Component or reach a compiled Server Action.

## What would reopen this

- A regression that shipped because a component test passed under happy-dom, where seam 3 could not reasonably have caught it.
- Or the CI cost changing materially: a browser already present on the runner image, or the `test` job no longer being the critical path.

Either is new evidence rather than a new opinion. Re-take the measurement rather than trusting the table above. The spike's migration notes remain on #318: the `process.env` shim that `next/link` needs (a `define` is broken by vitest-dev/vitest#11265), the cold-cache rule, and the provider's type augmentation.

## Prior requests

- #318: "Vitest Browser Mode can replace happy-dom and Testing Library: 50 of 55 files pass unmodified, at about 3.6x the wall time"
