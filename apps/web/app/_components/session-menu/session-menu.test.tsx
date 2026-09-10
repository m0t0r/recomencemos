/**
 * The session menu — what a running server cannot show cheaply.
 *
 * **It covers both shells, because there is only one menu.** `(site)` renders it
 * with an `accountHref` and `(admin)` without one (#17); the cases below drive
 * both, which is the whole reason the difference is a prop.
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
const { signOut, signOutAdmin } = vi.hoisted(() => ({
  signOut: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("./actions", () => ({ signOut, signOutAdmin }));

import { SessionMenu } from "./session-menu";
import { ACCOUNT, SIGN_OUT, SIGNED_IN_AS, sessionMenuLabel } from "./messages";
import { SIGN_OUT_FORM_ID } from "./slots";

const EMAIL = "maria.restrepo@gmail.com";

/** What `(site)` passes. `(admin)` passes the same minus `accountHref`. */
const SITE_PROPS = { email: EMAIL, action: signOut, accountHref: "/account" } as const;

beforeEach(() => {
  for (const action of [signOut, signOutAdmin]) {
    action.mockReset();
    action.mockResolvedValue({});
  }
});

describe("the signed-in trigger", () => {
  /**
   * **The borrowed-phone check, for a screen reader.** Variant B keeps the
   * address out of the row, so the trigger's accessible name is the only place
   * a non-sighted user meets it before opening anything — and it is the half
   * that must not regress if the visual design changes again.
   */
  it("announces the whole address, which the row does not show", () => {
    const { container } = render(<SessionMenu {...SITE_PROPS} />);

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
    render(<SessionMenu {...SITE_PROPS} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    // The address block is `aria-hidden` — the trigger already announced it — so
    // this is one of the two documented cases for reaching past the
    // accessibility tree: the question is whether the *pixels* carry it.
    expect(screen.getByRole("menu").textContent).toContain(EMAIL);
    expect(screen.getByRole("menu").textContent).toContain(SIGNED_IN_AS);

    expect(screen.getByRole("menuitem", { name: SIGN_OUT })).toBeInTheDocument();
  });

  /**
   * **The shell's only navigation, and the one thing #80 deferred.**
   *
   * The item announces as a `menuitem` rather than a `link` — that is the ARIA
   * menu pattern and the primitive's doing, so the role is not what to assert.
   * The `href` is: it is what a middle-click, a long-press and a person with no
   * pointer all use, and it is the half that silently rots if the route moves.
   */
  it("points at /account", async () => {
    const user = userEvent.setup();
    render(<SessionMenu {...SITE_PROPS} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    expect(screen.getByRole("menuitem", { name: ACCOUNT })).toHaveAttribute("href", "/account");
  });

  /**
   * **The profile row, in both of its states.** The label is the caller's
   * because it depends on what she has, and the `href` is what rots if a route
   * moves — so both halves are asserted, once per state.
   */
  it.each([
    ["/my-profile", "Tu perfil"],
    ["/publish", "Publica lo que sabes hacer"],
  ])("points the profile row at %s", async (href, label) => {
    const user = userEvent.setup();
    render(<SessionMenu {...SITE_PROPS} profile={{ href, label }} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute("href", href);
  });

  it("omits the profile row when none is given", async () => {
    const user = userEvent.setup();
    render(<SessionMenu {...SITE_PROPS} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    expect(screen.queryByRole("menuitem", { name: "Tu perfil" })).toBeNull();
  });

  /**
   * **The Admin's shell passes no `accountHref`**, and this is the case that says
   * the omission is real rather than a prop nobody reads. `/account` is the
   * Worker's own Account under a different shell; a row that navigated out of the
   * queue is the one part of this menu that would be wrong above `/admin`.
   */
  it("omits the account row entirely when no href is given", async () => {
    const user = userEvent.setup();
    render(<SessionMenu email={EMAIL} action={signOutAdmin} />);

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));

    expect(screen.queryByRole("menuitem", { name: ACCOUNT })).toBeNull();
    // The way out survives the omission, which is the half that matters.
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
    render(<SessionMenu {...SITE_PROPS} />);

    // `button.form` resolves a `form` attribute exactly as a submit does, so it
    // is the form each trigger would post — and "the same form" is one object,
    // which a second `<form>` or a trigger naming another id would both break.
    const fallback = screen.getByRole<HTMLButtonElement>("button", { name: SIGN_OUT });
    expect(fallback.form).toHaveAttribute("id", SIGN_OUT_FORM_ID);
    expect(fallback).toHaveAttribute("type", "submit");

    await user.click(screen.getByRole("button", { name: sessionMenuLabel(EMAIL) }));
    const item = screen.getByRole<HTMLButtonElement>("menuitem", { name: SIGN_OUT });
    expect(item).toHaveAttribute("form", SIGN_OUT_FORM_ID);
    expect(item.form).toBe(fallback.form);
  });

  /**
   * Bound arguments, not hidden inputs (ADR-0015). `signOut` takes none at all,
   * so the form posts nothing: the browser's serialiser over the form the
   * fallback submits is the whole question. React writes its own `$ACTION_*`
   * fields only into server-rendered HTML, so a client render carries none, and
   * any key here is a field of this app's own.
   */
  it("carries no hidden input of its own", () => {
    render(<SessionMenu {...SITE_PROPS} />);

    const form = screen.getByRole<HTMLButtonElement>("button", { name: SIGN_OUT }).form;

    expect(form === null ? null : [...new FormData(form).keys()]).toEqual([]);
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
 *
 * **It walks all of `app/_components`, not this directory**, because that is where
 * the shell now is: the menu, its actions, the `<noscript>` rule, `AppHeader` and
 * `StickyHeader`. A scan scoped to one folder would have stopped covering the
 * header the moment it moved.
 */
describe("no auth client reaches the browser", () => {
  it("imports nothing from better-auth anywhere in the shell", () => {
    const root = join(import.meta.dirname, "..");

    const sources = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .filter((entry) => !entry.name.includes(".test."))
      .map((entry) => ({
        name: entry.name,
        text: readFileSync(join(entry.parentPath, entry.name), "utf8"),
      }));

    // The suite is worthless if it read nothing, so the count is asserted too.
    expect(sources.length).toBeGreaterThanOrEqual(7);

    for (const { name, text } of sources) {
      expect(text, `${name} imports better-auth`).not.toMatch(/from\s+["']better-auth/);
    }
  });
});
