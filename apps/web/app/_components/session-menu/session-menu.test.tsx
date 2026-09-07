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
    const { container } = render(<SessionMenu {...SITE_PROPS} />);

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
    const { container } = render(<SessionMenu {...SITE_PROPS} />);

    const ours = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].filter(
      (input) => !input.name.startsWith("$ACTION"),
    );

    expect(ours).toHaveLength(0);
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

/**
 * **The popup stack stays off the first load, asserted over the source for the
 * same reason the block above is.**
 *
 * `dropdown-menu` is Base UI's `Menu`, and `Menu` pulls floating-ui with the
 * positioner, the focus guards and the scroll lock. It is the largest thing on
 * the first load of every route below a layout that renders this header, and
 * `packages/design-system/CLAUDE.md` carries the figure and how it was taken —
 * one home, so a number nobody can cheaply re-take cannot go wrong in three
 * places at once.
 *
 * The deferral in `session-menu-deferred.tsx` is what takes it off, and a static
 * import put back anywhere in the app would put it straight back with every case
 * above still green and the page still looking identical. Nothing a browser can
 * be driven to do would show it; the tell is an `import`.
 *
 * **It walks all of `app/`, not the header alone.** The claim is not "AppHeader
 * defers the menu" but "nothing in this app reaches the menu except the loader",
 * and a check scoped to one file would go on passing the moment a second surface
 * imported it. That is the design system's own rule read as a test — *which
 * client components import which registry components, and it is one grep*.
 *
 * **Whether SSR stays on is not asserted here.** `ssr: false` would leave the
 * `<noscript>` fallback unrendered and put *Salir* out of reach with scripting
 * disabled, which is a running-browser question and is verified at seam 3 like
 * every other one; a grep for the option over comment-stripped source pins the
 * spelling of a config key rather than the behaviour, and the reason it is not
 * used is in the loader beside the call.
 */
describe("the menu arrives in its own chunk", () => {
  /**
   * A specifier ending in `/session-menu` and nothing else — the siblings
   * `./no-script` and `./session-menu-deferred` are different modules and are
   * both fine to import. `export … from` is covered too: a re-export is a value
   * edge like any other.
   */
  const valueEdge = /(?:import|export)\s+(?!type\b)[^;]*?from\s+["'][^"']*\/session-menu["']/;

  /** The one module allowed to hold that edge. */
  const LOADER = "session-menu-deferred.tsx";

  it("is reached through the loader and from nowhere else in the app", () => {
    const root = join(import.meta.dirname, "..", "..");

    const sources = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .filter((entry) => !entry.name.includes(".test.") && entry.name !== LOADER)
      .map((entry) => ({
        name: entry.name,
        text: readFileSync(join(entry.parentPath, entry.name), "utf8"),
      }));

    // A walk that read nothing would pass silently, which is the one way this
    // case could be worse than not existing.
    expect(sources.length).toBeGreaterThanOrEqual(50);

    for (const { name, text } of sources) {
      expect(
        text,
        `${name} imports the menu directly — render <DeferredSessionMenu /> instead, ` +
          `and reach the module with \`import type\` if it is only a type you need`,
      ).not.toMatch(valueEdge);
    }
  });

  it("is reached by the loader, through a dynamic import", () => {
    const loader = readFileSync(join(import.meta.dirname, LOADER), "utf8");

    expect(loader).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/session-menu["']\)/);
  });
});
