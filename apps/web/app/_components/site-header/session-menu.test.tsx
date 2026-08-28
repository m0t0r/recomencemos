/**
 * The shell's Client Components — what a running server cannot show cheaply.
 *
 * **What is deliberately not tested here.** The `signOut` Server Action is
 * mocked, because an imported Server Action is not the compiled POST endpoint an
 * attacker reaches; asserting authorization against the import would be a green
 * test on a code path nobody attacks. Its revocation lives at seam 2
 * (`packages/domain/src/auth/sign-out.integration.test.ts`, which replays the old
 * cookie) and its behaviour as an endpoint at seam 3, against a running
 * `next dev`.
 *
 * What is real here is the wiring: which controls exist, what each announces,
 * and the structural claim the whole no-JavaScript story rests on — that the two
 * sign-out triggers are two buttons on **one** form.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * `vi.hoisted` so the imports below stay static: `vi.mock` is lifted above every
 * `const` in the file, and a factory closing over a plain `const signOut =
 * vi.fn()` would read it in its temporal dead zone the moment the mocked module
 * is imported.
 */
const { signOut, pathname } = vi.hoisted(() => ({
  signOut: vi.fn(),
  pathname: vi.fn(() => "/"),
}));

vi.mock("./actions", () => ({ signOut }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

import { SignInLink } from "./sign-in-link";
import { SessionMenu } from "./session-menu";
import { SIGN_IN, SIGN_OUT, SIGNED_IN_AS, sessionMenuLabel } from "./messages";
import { SIGN_OUT_FORM_ID } from "./slots";

const EMAIL = "maria.restrepo@gmail.com";

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue({});
  pathname.mockReturnValue("/");
});

describe("the signed-in trigger", () => {
  /**
   * **The borrowed-phone check, for a screen reader.** Variant B keeps the
   * address out of the row, so the trigger's accessible name is the only place
   * a non-sighted user meets it before opening anything — and it is the half
   * that must not regress if the visual design changes again.
   */
  it("announces the whole address, which the row does not show", () => {
    const { container } = render(<SessionMenu email={EMAIL} />);

    // The `name` filter *is* the assertion — a role query that finds it has
    // already proved the accessible name. Re-asserting with
    // `toHaveAccessibleName` only restated it, and needed an
    // `as unknown as string` cast to type-check, which is the tell.
    expect(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) })).toBeInTheDocument();

    // The half a role query cannot state: the address is announced but **not
    // rendered in the row**, which is the whole trade variant B made. A
    // regression that put it back visibly would leave the assertion above green.
    expect(container.textContent).not.toContain(EMAIL);
  });

  it("opens a menu holding the untruncated address and the way out", async () => {
    const user = userEvent.setup();
    render(<SessionMenu email={EMAIL} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    // The address block is `aria-hidden` — the trigger already announced it — so
    // this is one of the two documented cases for reaching past the
    // accessibility tree: the question is whether the *pixels* carry it.
    expect(screen.getByRole("menu").textContent).toContain(EMAIL);
    expect(screen.getByRole("menu").textContent).toContain(SIGNED_IN_AS);

    expect(screen.getByRole("menuitem", { name: SIGN_OUT })).toBeInTheDocument();
  });
});

describe("one form, two triggers", () => {
  /**
   * **The structural claim the no-JavaScript story rests on.** The fallback is a
   * second *trigger*, not a second sign-out path — so if these two ever name
   * different forms, or a second `<form>` appears, the two paths have diverged
   * and the one nobody looks at is the one that rots.
   */
  it("submits the same form from the menu and from the fallback", async () => {
    const user = userEvent.setup();
    const { container } = render(<SessionMenu email={EMAIL} />);

    // A `<form>` has no role until it has an accessible name, so counting them
    // is a markup question by definition — the second documented escape hatch.
    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]?.id).toBe(SIGN_OUT_FORM_ID);

    const fallback = screen.getByRole("button", { name: SIGN_OUT });
    expect(fallback).toHaveAttribute("form", SIGN_OUT_FORM_ID);
    expect(fallback).toHaveAttribute("type", "submit");

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));
    expect(screen.getByRole("menuitem", { name: SIGN_OUT })).toHaveAttribute(
      "form",
      SIGN_OUT_FORM_ID,
    );
  });

  /**
   * Bound arguments, not hidden inputs (ADR-0015). `signOut` takes none at all,
   * so the assertion is that the form carries no field of this app's own — React
   * adds its own `$ACTION_*` fields, and those are the framework's.
   */
  it("carries no hidden input of its own", () => {
    const { container } = render(<SessionMenu email={EMAIL} />);

    const ours = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].filter(
      (input) => !input.name.startsWith("$ACTION"),
    );

    expect(ours).toHaveLength(0);
  });
});

describe("the signed-out link", () => {
  it("offers Entrar, pointing at the sign-in surface", () => {
    render(<SignInLink />);

    expect(screen.getByRole("link", { name: SIGN_IN })).toHaveAttribute("href", "/sign-in");
  });

  /**
   * A link to the page you are on is worse than no link, and `/sign-in` is the
   * one route where the destination and the origin are the same.
   */
  it("says nothing on /sign-in itself", () => {
    pathname.mockReturnValue("/sign-in");
    render(<SignInLink />);

    expect(screen.queryByRole("link", { name: SIGN_IN })).toBeNull();
  });
});

/**
 * **ADR-0015, asserted over this surface's own source.**
 *
 * `sign-in-form.test.tsx` makes the same assertion for `/sign-in`; the shell is
 * the second place in the app that touches a session, so it is the second place
 * the rule can be broken. Reading the files beats any runtime check here: the
 * failure this catches is an `import`, and an import that is never executed
 * still ships the client bundle it pulls in.
 */
describe("no auth client reaches the browser", () => {
  it("imports nothing from better-auth anywhere in the shell", () => {
    const directory = import.meta.dirname;

    const sources = readdirSync(directory)
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((name) => ({ name, text: readFileSync(join(directory, name), "utf8") }));

    // The suite is worthless if it read nothing, so the count is asserted too.
    expect(sources.length).toBeGreaterThanOrEqual(5);

    for (const { name, text } of sources) {
      expect(text, `${name} imports better-auth`).not.toMatch(/from\s+["']better-auth/);
    }
  });
});
