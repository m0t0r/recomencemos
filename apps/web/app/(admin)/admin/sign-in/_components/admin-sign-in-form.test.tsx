/**
 * The Admin door's Client Component, and the two guards that would otherwise be
 * left to review.
 *
 * **The Server Actions are mocked**, for the reason `sign-in-form.test.tsx` gives:
 * an imported Server Action is not the compiled POST endpoint an attacker reaches,
 * so asserting authorization against the import would be a green test on a code
 * path nobody attacks. NFR14 is verified at seam 2 over real sessions and at seam
 * 3 against a running server. What is real here is the wiring a running server
 * cannot show cheaply — which step renders when, what each form carries with it,
 * and that this surface holds no auth client.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

/**
 * The three actions, replaced. `vi.hoisted` is what lets the imports below stay
 * static: `vi.mock` is lifted above every `const` in this file, so a factory
 * closing over a plain `const signInAdmin = vi.fn()` would read it in its temporal
 * dead zone the moment the mocked module is evaluated.
 *
 * `vi.fn()`s rather than inline arrows because `verifyAdminCode` is `.bind`-ed
 * with its `kind`, and a recorded call is how that bound argument is asserted.
 */
const { signInAdmin, verifyAdminCode, enrolAdminCode } = vi.hoisted(() => ({
  signInAdmin: vi.fn(),
  verifyAdminCode: vi.fn(),
  enrolAdminCode: vi.fn(),
}));

vi.mock("../actions", () => ({ signInAdmin, verifyAdminCode, enrolAdminCode }));

import { AdminSignInForm } from "./admin-sign-in-form";
import { CODE_LABEL, EMAIL_LABEL, PASSWORD_LABEL } from "../_lib/messages";

describe("the password step", () => {
  it("asks for an address and a password, and nothing else", () => {
    render(<AdminSignInForm />);

    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeInTheDocument();
  });

  /**
   * **NFR14 as a rendering assertion.** A correct password lands one field short
   * of the queue, so the code field must not be reachable before the server has
   * said which stage the caller is in. If this ever failed, the door would be
   * offering a second factor to somebody who has not passed the first.
   */
  it("offers no second factor until the server says the password was accepted", () => {
    render(<AdminSignInForm />);
    expect(screen.queryByLabelText(CODE_LABEL)).not.toBeInTheDocument();
  });

  /**
   * ADR-0015: values that travel with a submit but are not typed into it are bound
   * arguments, not hidden inputs. The second factor's `kind` is the one this
   * surface has, and it is the one that matters — a caller able to flip it turns a
   * six-digit brute force into a backup-code brute force against a different
   * stored value.
   *
   * The escape hatch to `querySelector` is the documented one: a hidden input has
   * no accessible role by definition, so its **absence** is unassertable any other
   * way.
   */
  it("carries no hidden inputs at all", () => {
    const { container } = render(<AdminSignInForm />);
    expect(container.querySelectorAll('input[type="hidden"]').length).toBe(0);
  });

  /**
   * The password manager must be told this is an existing credential.
   * `new-password` here would have it offer to generate one — on a door where
   * sign-up is closed, that is an offer to lock the Admin out of the platform they
   * moderate.
   */
  it("asks the password manager for the existing password, never a new one", () => {
    render(<AdminSignInForm />);
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveAttribute(
      "autoComplete",
      "current-password",
    );
  });

  /**
   * **No empty announcement region before there is anything to announce.**
   *
   * The region is rendered conditionally, matching `(site)/account`'s panel, and
   * this is the half worth asserting: an always-present empty `role="status"` is
   * something a screen-reader user can land on and hear nothing from — which is
   * exactly the bug review found in the queue's own panel, where focus moved to a
   * region whose content had not been rendered.
   *
   * The populated case is verified where the message actually comes from a server:
   * seam 3, driving `/admin/sign-in` in a browser.
   */
  it("renders no announcement region until there is something to announce", () => {
    render(<AdminSignInForm />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/**
 * **The regression guard, copied from `/sign-in` because the rule is the same and
 * the sweep was not.** That suite walks `app/(site)/(auth)/sign-in/`; this surface
 * is a different directory and would have been uncovered.
 *
 * ADR-0015: no `apps/web` module may import `better-auth/react`, and nothing in a
 * browser holds an auth client. The failure is invisible in review and not subtle
 * in production — one import puts the auth client, `@better-fetch`, `nanostores`
 * and `defu` into a bundle — and this is the surface where reaching for
 * `authClient.twoFactor.verifyTotp()` is most tempting, because it is the shape
 * every Better Auth 2FA guide shows.
 */
function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

/**
 * Comments stripped before matching, for the reason the other sweep records: the
 * first version failed on prose *about* the thing being banned. A rule that
 * refuses the sentence documenting it teaches everyone to stop writing the
 * sentence.
 */
function code(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/[^\n]*/g, "");
}

describe("no auth client reaches the browser", () => {
  // The whole `(admin)` group, not just this folder: the queue's own action file
  // is as good a place to reach for a client as the door's.
  const root = join(import.meta.dirname, "..", "..", "..");

  it.each(sourcesUnder(root).map((path) => [path.slice(root.length + 1), path]))(
    "%s imports no auth client",
    (_name, path) => {
      const source = code(readFileSync(path, "utf8"));

      expect(source).not.toMatch(/from\s+["']better-auth\/react["']/);
      expect(source).not.toMatch(/from\s+["']better-auth\/client["']/);
      expect(source).not.toMatch(/createAuthClient/);
      // The 2FA plugin's browser half, which is what a guide would have you add
      // beside `createAuthClient` — named separately so the failure says which.
      expect(source).not.toMatch(/twoFactorClient/);
    },
  );
});
