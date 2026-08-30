/**
 * The Client Component half of `/sign-in`, which is exactly what
 * `## Testing Decisions` sends here: _"the Client Components this effort adds:
 * the shared-device checkbox … and the form's error states."_
 *
 * **What is deliberately not tested here.** The Server Actions are mocked,
 * because an imported Server Action is not the compiled POST endpoint an
 * attacker reaches — asserting authorization against the import would be a green
 * test on a code path nobody attacks. Their logic lives at seams 1 and 2, and
 * their behaviour as endpoints is verified at seam 3 against a running
 * `next dev`. What is real here is the wiring a running server cannot show
 * cheaply: which controls exist, what each door carries with it, and which
 * sentence each outcome puts on screen.
 *
 * **There is no `better-auth/react` mock any more, and its absence is the
 * point.** This file used to stub `createAuthClient` because the Google door was
 * a browser call. Both doors are Server Actions now, so the browser holds no
 * auth client to stub — see "no auth client reaches the browser" below, which
 * asserts that rather than leaving it to be noticed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Both actions, replaced. `vi.mock` is hoisted above the imports, so the
 * `"use server"` module is never evaluated and `next/headers` is never reached.
 *
 * They are `vi.fn()`s rather than inline arrows because the component calls
 * `.bind(null, returnPath, sharedDevice)` on them — so a recorded call carries
 * the bound arguments ahead of React's own, which is how the two values that
 * used to be hidden inputs are asserted now.
 *
 * **`vi.hoisted` is what lets the imports below be static, and it is required
 * rather than decorative.** `vi.mock` is lifted above every `const` in this
 * file, so a factory closing over a plain `const requestMagicLink = vi.fn()`
 * reads it in the temporal dead zone the moment a static import evaluates the
 * mocked module — `ReferenceError: Cannot access 'requestMagicLink' before
 * initialization`. This file used to dodge that with `await import(...)`, which
 * worked only because a dynamic import runs after the module body. `vi.hoisted`
 * lifts the definitions instead, which is the thing it exists for.
 */
const { requestMagicLink, startGoogleSignIn } = vi.hoisted(() => ({
  requestMagicLink: vi.fn(),
  startGoogleSignIn: vi.fn(),
}));

vi.mock("../actions", () => ({ requestMagicLink, startGoogleSignIn }));

import { SignInForm } from "./sign-in-form";
import {
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LOOKS_WRONG,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_LABEL,
} from "../_lib/messages";

beforeEach(() => {
  requestMagicLink.mockReset();
  requestMagicLink.mockResolvedValue({});
  startGoogleSignIn.mockReset();
  startGoogleSignIn.mockResolvedValue({});
});

function renderForm(props: Partial<Parameters<typeof SignInForm>[0]> = {}) {
  return render(<SignInForm googleAvailable returnPath="/" {...props} />);
}

describe("the two doors", () => {
  it("offers both when Google is configured", () => {
    renderForm();

    expect(screen.getByRole("button", { name: GOOGLE_BUTTON })).toBeTruthy();
    expect(screen.getByRole("button", { name: SEND_LINK_BUTTON })).toBeTruthy();
  });

  // A button posting to an unconfigured provider is the dead end this surface
  // must never be, so the door is absent rather than broken. This is the state a
  // fresh clone and CI actually run in.
  it("omits the Google door entirely when it is not configured", () => {
    renderForm({ googleAvailable: false });

    expect(screen.queryByRole("button", { name: GOOGLE_BUTTON })).toBeNull();
    expect(screen.queryByText(GOOGLE_ACCOUNT_NOTICE)).toBeNull();
    // And the "o" separator goes with it, rather than dangling above the form.
    expect(screen.queryByText("o")).toBeNull();
    expect(screen.getByRole("button", { name: SEND_LINK_BUTTON })).toBeTruthy();
  });

  // The ticket's own criterion: she is told she needs a mailbox she can open
  // *before* she types one, so this is on screen at first render.
  it("says she needs an address she can open, before she types", () => {
    renderForm();

    expect(screen.getByText(EMAIL_DOOR_PRECONDITION)).toBeTruthy();
  });

  // The borrowed-Android hazard, where a person will read it.
  it("names what Google will ask, beside the Google button", () => {
    renderForm();

    expect(screen.getByText(GOOGLE_ACCOUNT_NOTICE)).toBeTruthy();
  });
});

describe("the shared-device checkbox", () => {
  it("starts unticked, which is the 30-day answer", () => {
    renderForm();

    expect(
      screen.getByRole("checkbox", { name: SHARED_DEVICE_LABEL }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  /**
   * **It governs both doors, and it is now a bound argument rather than a hidden
   * input.** The old shape mirrored the checkbox into
   * `<input type="hidden" name="sharedDevice" value="on|off">` and depended on
   * that string being spelled the same here and in the schema. React serialises
   * the boolean now, so what is asserted is the value the action actually
   * receives — which is the thing that matters and the thing the string spelling
   * was only ever a proxy for.
   */
  it("carries own-device to the email door while unticked", async () => {
    const user = userEvent.setup();
    renderForm({ returnPath: "/profile" });

    await user.type(screen.getByRole("textbox"), "ana@example.co");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    expect(requestMagicLink.mock.calls[0]?.slice(0, 2)).toEqual(["/profile", false]);
  });

  it("carries shared-device to the email door once ticked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: SHARED_DEVICE_LABEL }));
    await user.type(screen.getByRole("textbox"), "ana@example.co");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    expect(requestMagicLink.mock.calls[0]?.slice(0, 2)).toEqual(["/", true]);
  });

  // The same answer has to reach the Google door, which is a different form —
  // one checkbox, two forms, and no mirror of its value in either.
  it("carries the same answer to the Google door", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: SHARED_DEVICE_LABEL }));
    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(startGoogleSignIn.mock.calls[0]?.slice(0, 2)).toEqual(["/", true]);
  });

  it("declares own-device to the Google door when unticked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(startGoogleSignIn.mock.calls[0]?.slice(0, 2)).toEqual(["/", false]);
  });
});

describe("what she is told on the way back", () => {
  it("says nothing before anything has happened", () => {
    renderForm();

    expect(screen.queryByText(/Revisa tu correo/)).toBeNull();
  });

  // "Google failed → the email door is still offered, never a dead end."
  it("offers the email door when Google failed", () => {
    renderForm({ error: "unable_to_create_user" });

    expect(screen.getByText(/pedir un enlace a tu correo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: SEND_LINK_BUTTON })).toBeTruthy();
  });

  // A consumed link is not an error, and the next thing on screen is a resend.
  it("offers an immediate resend on a consumed link", () => {
    renderForm({ error: "INVALID_TOKEN" });

    expect(screen.getByText(/ya se usó o se venció/)).toBeTruthy();
    expect(screen.getByRole("button", { name: RESEND_LINK_BUTTON })).toBeTruthy();
  });

  // The consumed-link copy must not read as her mistake.
  it("does not call a consumed link an error", () => {
    renderForm({ error: "INVALID_TOKEN" });

    expect(screen.queryByText(/error/i)).toBeNull();
  });

  // The live region is what a screen reader hears, and focus lands on it rather
  // than on the field — what happened, before where to fix it.
  it("puts every outcome in one polite live region", () => {
    renderForm({ error: "INVALID_TOKEN" });
    // `role="status"` is the region, and asking for it by role is what proves it
    // is in the accessibility tree at all — an `aria-live` attribute on a div
    // with no role is reachable by CSS selector and by nothing a user has.
    const region = screen.getByRole("status");

    expect(region).toHaveTextContent("ya se usó");
    // Focusable programmatically, but not in the tab order.
    expect(region).toHaveAttribute("tabindex", "-1");
  });
});

describe("client-side validation", () => {
  // The whole justification for the form layer: she learns about a typo without
  // spending a round trip on a connection that may be slow.
  it("names a wrong-shaped address without calling the action", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    expect(await screen.findByText(EMAIL_LOOKS_WRONG)).toBeTruthy();
    expect(requestMagicLink).not.toHaveBeenCalled();
  });

  /**
   * The sentence she sees is the schema's own, which is `docs/policy/voice.md`'s
   * — not Zod's English default. The schema carries it (see `_lib/schema.ts`),
   * so this asserts the message survives TanStack Form's Standard Schema path
   * rather than being replaced by a fallback the component supplies.
   */
  it("shows the voice guide's sentence, not the validator's", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    const message = await screen.findByText(EMAIL_LOOKS_WRONG);
    expect(message.textContent).toBe(EMAIL_LOOKS_WRONG);
  });

  it("marks the field invalid for a screen reader, not only in colour", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    /**
     * **The target has to resolve, not merely exist.** This assertion used to be
     * `toBeTruthy()` on the attribute, which passes while pointing at an id
     * nothing rendered — and review found exactly that state was reachable when
     * the server rejected an address and the client had no error of its own. A
     * screen reader following a dangling `aria-describedby` finds nothing, and
     * NFR20 is WCAG 2.2 AA.
     */
    expect(input).toHaveAccessibleDescription(EMAIL_LOOKS_WRONG);
  });

  /**
   * **The state the dangling `aria-describedby` was reachable in.** The server
   * rejects the address and the client has no error of its own — which is every
   * refusal when JavaScript is unavailable, and any case where the two parses
   * disagree. Before the fix the field was marked invalid and pointed at an id
   * nothing had rendered.
   */
  it("names the server's rejection where aria-describedby points", async () => {
    const user = userEvent.setup();
    requestMagicLink.mockResolvedValue({
      validationErrors: { email: { _errors: ["rejected by the server"] } },
    });

    renderForm();

    await user.type(screen.getByRole("textbox"), "ana@example.co");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    const input = await screen.findByRole("textbox");
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));

    expect(input).toHaveAccessibleDescription(EMAIL_LOOKS_WRONG);
  });

  // A valid submit is never intercepted, so the server still performs the parse
  // that actually decides.
  it("does not intercept a submit the browser has no objection to", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana@example.co");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    expect(screen.queryByText(EMAIL_LOOKS_WRONG)).toBeNull();
    expect(requestMagicLink).toHaveBeenCalled();
  });
});

describe("the form before hydration", () => {
  /**
   * The form layer must not become the only way to submit. A native `action`
   * plus a named input is what makes a pre-hydration submit reach the Server
   * Action, and it is the pattern story 2 copies — NFR4 requires `/publish` to
   * work with JavaScript unavailable, and a form abstraction that only works
   * hydrated would put that out of reach.
   *
   * **`sharedDevice` and `returnPath` are no longer named inputs**, and this
   * test asserts their absence rather than merely stopping short of asserting
   * their presence: they are bound arguments, which React encodes into the
   * action reference itself, so a hidden input mirroring either one would be a
   * second source for a value that already travels.
   */
  it("keeps a native action and a named email field", () => {
    // **The one place a raw DOM query is the right tool, and the rule is in
    // `CLAUDE.md`.** "Are there two `<form>` elements, each with an `action`?"
    // is a question about the HTML that survives with no JavaScript, not about
    // the accessibility tree — a `<form>` has no implicit role until it carries
    // an accessible name, and giving it one purely so a test could ask for it
    // would be markup written for the test. Everything a role query *can*
    // answer is asked that way instead.
    const { container } = renderForm();
    const forms = container.querySelectorAll("form");

    // Two doors, two forms, both with an action.
    expect(forms.length).toBe(2);
    for (const form of forms) expect(form.getAttribute("action")).toBeTruthy();

    expect(screen.getByRole("textbox")).toHaveAttribute("name", "email");
  });

  it("carries no hidden inputs at all", () => {
    // The same escape hatch, and the clearest case for it: a hidden input has no
    // accessible role *by definition*, so its absence is unassertable through
    // any query built on the accessibility tree.
    const { container } = renderForm();

    expect(container.querySelectorAll('input[type="hidden"]').length).toBe(0);
    expect(container.querySelector('input[name="sharedDevice"]')).toBeNull();
    expect(container.querySelector('input[name="returnPath"]')).toBeNull();
  });

  /**
   * The Google door used to be a click handler, so an unhydrated page showed a
   * button that did nothing at all. It is a submit inside a form with a Server
   * Action now, which is what makes it work with JavaScript unavailable.
   */
  it("makes the Google door a submit rather than a click handler", () => {
    renderForm();
    const google = screen.getByRole("button", { name: GOOGLE_BUTTON });

    expect(google.getAttribute("type")).toBe("submit");
    expect(google.closest("form")).toBeTruthy();
  });
});

/**
 * **The regression guard for the whole server-side rework.**
 *
 * Asserting this by rendering is not possible — a browser bundle is a build
 * artefact and this suite is not a build. So it is asserted over the source of
 * everything on this surface's client path, which is the thing a person would
 * actually change by accident: reaching for `createAuthClient` because it is the
 * shape every Better Auth tutorial shows.
 *
 * The failure this prevents is not subtle in production and is invisible in
 * review: one `better-auth/react` import puts the auth client, `@better-fetch`,
 * `nanostores` and `defu` back into the bundle a Worker downloads on a metered
 * connection, and NFR3's budget is measured on `/` and `/publish` rather than
 * here — so nothing else would report it.
 */
/** Every source file on this surface's client path, tests excluded. */
function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

/**
 * **Comments are stripped before matching, and that is not a convenience.** The
 * first version of the guard below failed on `actions.ts`, whose doc comment
 * explains that the door "was `createAuthClient().signIn.social(...)` from a
 * Client Component" — prose about the thing being banned, read as the thing
 * itself. It is the same false-positive class `gate-lib.sh` strips heredocs for:
 * a rule that refuses the sentence documenting it teaches everyone to stop
 * writing the sentence.
 */
function code(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/[^\n]*/g, "");
}

describe("no auth client reaches the browser", () => {
  const root = join(import.meta.dirname, "..");
  it.each(sourcesUnder(root).map((path) => [path.slice(root.length + 1), path]))(
    "%s imports no auth client",
    (_name, path) => {
      const source = code(readFileSync(path, "utf8"));

      // `actions.ts` legitimately reaches `lib/auth`, which is server-only. What
      // must never appear anywhere on this surface is the *browser* client.
      expect(source).not.toMatch(/from\s+["']better-auth\/react["']/);
      expect(source).not.toMatch(/createAuthClient/);
    },
  );
});
