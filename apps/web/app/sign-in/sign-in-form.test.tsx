/**
 * The Client Component half of `/sign-in`, which is exactly what
 * `## Testing Decisions` sends here: _"the Client Components this effort adds:
 * the shared-device checkbox … and the form's error states."_
 *
 * **What is deliberately not tested here.** The Server Action is mocked, because
 * an imported Server Action is not the compiled POST endpoint an attacker
 * reaches — asserting authorization against the import would be a green test on
 * a code path nobody attacks. Its logic lives at seams 1 and 2, and its
 * behaviour as an endpoint is verified at seam 3 against a running `next dev`.
 * What is real here is the wiring a running server cannot show cheaply: which
 * controls exist, what the checkbox posts, and which sentence each outcome puts
 * on screen.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RequestMagicLinkState } from "./actions";

/**
 * The action, replaced. `vi.mock` is hoisted above the imports, so the
 * `"use server"` module is never evaluated and `next/headers` is never reached.
 */
const requestMagicLink =
  vi.fn<(previous: RequestMagicLinkState, form: FormData) => Promise<RequestMagicLinkState>>();

vi.mock("./actions", () => ({
  requestMagicLink: (previous: RequestMagicLinkState, form: FormData) =>
    requestMagicLink(previous, form),
}));

/** Better Auth's browser client, replaced so no network call is attempted. */
const signInSocial = vi.fn();

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signIn: { social: signInSocial } }),
}));

const { SignInForm } = await import("./sign-in-form");
const {
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LOOKS_WRONG,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_LABEL,
} = await import("./messages");

beforeEach(() => {
  requestMagicLink.mockReset();
  requestMagicLink.mockResolvedValue({ status: "idle" });
  signInSocial.mockReset();
  signInSocial.mockResolvedValue({ error: null });
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

  // It governs both doors, so its value has to travel with the email submit as
  // well as with the Google click. `"on"` is what a checked checkbox posts and
  // what the action reads — one spelling, not two.
  it("posts 'off' with the form while unticked", () => {
    const { container } = renderForm();
    const hidden = container.querySelector<HTMLInputElement>('input[name="sharedDevice"]');

    expect(hidden?.value).toBe("off");
  });

  it("posts 'on' with the form once ticked", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();

    await user.click(screen.getByRole("checkbox", { name: SHARED_DEVICE_LABEL }));

    const hidden = container.querySelector<HTMLInputElement>('input[name="sharedDevice"]');
    expect(hidden?.value).toBe("on");
  });

  // The same answer has to reach the Google door, which does not go through the
  // form at all — it travels as a request header instead.
  it("declares the same answer to the Google door", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: SHARED_DEVICE_LABEL }));
    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
      expect.objectContaining({
        headers: { "x-recomencemos-shared-device": "1" },
      }),
    );
  });

  it("declares own-device to the Google door when unticked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(signInSocial).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: { "x-recomencemos-shared-device": "0" } }),
    );
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
    const { container } = renderForm({ error: "INVALID_TOKEN" });
    const region = container.querySelector('[aria-live="polite"]');

    expect(region).toBeTruthy();
    expect(region?.textContent).toContain("ya se usó");
    // Focusable programmatically, but not in the tab order.
    expect(region?.getAttribute("tabindex")).toBe("-1");
  });
});

describe("per-door loading", () => {
  // "The two buttons are busy independently and the form stays readable."
  it("leaves the email door usable while Google is busy", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    signInSocial.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ error: null });
      }),
    );

    renderForm();
    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    const google = screen.getByRole("button", { name: GOOGLE_BUTTON });
    const email = screen.getByRole("button", { name: SEND_LINK_BUTTON });

    expect(google.getAttribute("aria-busy")).toBe("true");
    expect(email.getAttribute("aria-busy")).not.toBe("true");
    expect(email.hasAttribute("disabled")).toBe(false);

    release?.();
  });

  it("reports a failed Google sign-in rather than spinning forever", async () => {
    const user = userEvent.setup();
    // Better Auth returns `{ error }` rather than throwing, which is the vendor's
    // own most-cited mistake and the reason this case exists.
    signInSocial.mockResolvedValue({ error: { message: "nope" } });

    renderForm();
    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(await screen.findByText(/No pudimos entrar con Google/)).toBeTruthy();
    expect(screen.getByRole("button", { name: GOOGLE_BUTTON }).getAttribute("aria-busy")).not.toBe(
      "true",
    );
  });

  it("reports a thrown Google failure the same way", async () => {
    const user = userEvent.setup();
    signInSocial.mockRejectedValue(new Error("network"));

    renderForm();
    await user.click(screen.getByRole("button", { name: GOOGLE_BUTTON }));

    expect(await screen.findByText(/No pudimos entrar con Google/)).toBeTruthy();
  });
});

describe("the design system's own controls", () => {
  // `Input` ships `text-base md:text-sm` — 16px on a phone so iOS Safari does not
  // zoom the viewport on focus, 14px from `md` up. An override here flattens that
  // responsive step while looking like it reinforces it, which is what happened
  // once and is why this assertion exists.
  it("leaves the email field's responsive type size alone", () => {
    const { container } = renderForm();
    const input = container.querySelector('input[name="email"]');

    expect(input?.className).toContain("md:text-sm");
    expect(input?.className).not.toMatch(/\bh-1[0-9]\b/);
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

  it("marks the field invalid for a screen reader, not only in colour", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
  });

  // A valid submit is never intercepted, so the server still performs the parse
  // that actually decides.
  it("does not intercept a submit the browser has no objection to", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox"), "ana@example.co");
    await user.click(screen.getByRole("button", { name: SEND_LINK_BUTTON }));

    expect(screen.queryByText(EMAIL_LOOKS_WRONG)).toBeNull();
  });
});

describe("the form before hydration", () => {
  /**
   * The form layer must not become the only way to submit. `action` plus named
   * inputs is what makes a pre-hydration submit reach the Server Action, and it
   * is the pattern story 2 copies — NFR4 requires `/publish` to work with
   * JavaScript unavailable, and a form abstraction that only works hydrated
   * would put that out of reach.
   */
  it("keeps a native action and named fields", () => {
    const { container } = renderForm();
    const form = container.querySelector("form");

    expect(form?.getAttribute("action")).toBeTruthy();
    expect(container.querySelector('input[name="email"]')).toBeTruthy();
    expect(container.querySelector('input[name="sharedDevice"]')).toBeTruthy();
    expect(container.querySelector('input[name="returnPath"]')).toBeTruthy();
  });
});
