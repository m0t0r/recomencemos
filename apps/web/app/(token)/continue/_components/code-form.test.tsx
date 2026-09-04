/**
 * The Client Component half of the second-factor screen.
 *
 * **What is deliberately not tested here.** The Server Action is mocked, because
 * an imported Server Action is not the compiled POST endpoint an attacker
 * reaches — asserting authorization against the import would be a green test on
 * a code path nobody attacks. The code check itself is `@repo/domain`'s and is
 * covered at seams 1 and 2; the endpoint's behaviour is verified at seam 3
 * against a running `next dev`, including an unauthenticated POST straight at
 * it.
 *
 * What is real here is the part a running server cannot show cheaply and that
 * this surface's brief is mostly *about*: which controls exist, what the field
 * refuses to tell the browser about itself, when the form submits itself, and
 * which sentence each outcome puts on screen.
 *
 * **`vi.hoisted`, so the imports below stay static.** `vi.mock` is lifted above
 * every `const` in this file, so a factory closing over a plain `const
 * verifyCode = vi.fn()` reads it in its temporal dead zone the moment a static
 * import evaluates the mocked module.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { verifyCode } = vi.hoisted(() => ({ verifyCode: vi.fn() }));

vi.mock("../actions", () => ({ verifyCode }));

import { GENERIC_ERROR_CODE } from "@repo/errors/app-error";
import { CodeForm, feedbackFor } from "./code-form";
import { CODE_DESCRIPTION, CODE_LABEL, CONTINUE_FAILED, SUBMIT_BUTTON } from "../_lib/messages";

/** What `@repo/domain` sends back for a code that did not check out. */
const REFUSED = {
  code: "admin_code_refused",
  message: "Ese código no sirve. Prueba otra vez, o usa uno de tus códigos de respaldo.",
  requestId: "",
};

/** The ceiling's own sentence, which names the wait and the printed codes. */
const LOCKED = {
  code: "admin_code_rate_limited",
  message:
    "Escribiste 10 códigos incorrectos, que es el máximo. Puedes intentarlo otra vez en 15 " +
    "minutos. Si guardaste un código de respaldo, ese sí funciona.",
  requestId: "",
  retryAfter: 900,
};

beforeEach(() => {
  verifyCode.mockReset();
  verifyCode.mockResolvedValue({});
});

describe("the field", () => {
  it("is one box, reachable by its label, with a description naming both codes", () => {
    render(<CodeForm />);

    const field = screen.getByRole("textbox", { name: CODE_LABEL });

    expect(field).toHaveAccessibleDescription(CODE_DESCRIPTION);
    // One box, not six. `input-otp` is in the registry and is not used here: it
    // cannot hold an eight-character hyphenated backup code, and a fixed slot
    // count makes the one-field decision unimplementable.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  /**
   * **The usual TOTP recipe is wrong on this field, and each attribute is wrong
   * for its own reason.** A numeric keypad makes an alphanumeric backup code
   * untypable on the phone this Admin occasionally uses; a one-time-code hint
   * offers to fill in six digits somebody whose phone is gone does not have.
   * They are asserted absent rather than left to a reviewer because both are
   * what a later editor would reach for first.
   */
  it("does not wear the six-digit affordances", () => {
    render(<CodeForm />);

    const field = screen.getByRole("textbox", { name: CODE_LABEL });

    expect(field.getAttribute("inputmode")).toBeNull();
    expect(field.getAttribute("autocomplete")).not.toBe("one-time-code");
    expect(field.getAttribute("spellcheck")).toBe("false");
    expect(field.getAttribute("autocapitalize")).toBe("off");
  });

  // The hands already know what to do, and there is one stop before the button.
  it("is focused on arrival", () => {
    render(<CodeForm />);

    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: CODE_LABEL }));
  });
});

describe("submitting", () => {
  /**
   * **The button is the mechanism.** Auto-submit is an accelerator, so losing it
   * costs a keystroke rather than the session — which is only true if the button
   * works on its own, including for a value auto-submit will never fire on.
   */
  it("submits a printed code on the button", async () => {
    const user = userEvent.setup();
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "ABCD-2345");
    await user.click(screen.getByRole("button", { name: SUBMIT_BUTTON }));

    await waitFor(() => expect(verifyCode).toHaveBeenCalledTimes(1));
    // Verbatim, hyphen and all. Normalising is the door's job — it strips the
    // hyphen and upper-cases — and a surface that did it first would be a second
    // place that rule lives.
    expect(formDataOf(verifyCode).get("code")).toBe("ABCD-2345");
  });

  /**
   * **Six digits and nothing else**, which is what an authenticator produces and
   * is the same anchor `classifyAdminCode` uses on the server. The two are
   * deliberately not one function: this one decides only whether to press the
   * button early, and the server's is the one that picks a factor.
   */
  it("submits itself the moment six digits are complete", async () => {
    const user = userEvent.setup();
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "12345");
    expect(verifyCode).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "6");

    await waitFor(() => expect(verifyCode).toHaveBeenCalledTimes(1));
    expect(formDataOf(verifyCode).get("code")).toBe("123456");
  });

  /**
   * **A printed code typed as printed never fires it**, whatever its digits: the
   * fifth character is the hyphen, so no prefix is ever six digits. This is the
   * property the whole accelerator rests on, and `2345-67AB` is the worst case
   * for it — every character a digit except the two the constraint guarantees.
   */
  it("never fires while a printed code is being typed as printed", async () => {
    const user = userEvent.setup();
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "2345-67AB");

    expect(verifyCode).not.toHaveBeenCalled();
  });

  /**
   * **And the one case that is not covered, asserted rather than hidden.** The
   * door normalises, so a code typed without its hyphen works — and about one in
   * four thousand of those has six digits in front of its letters. The
   * accelerator fires on the prefix; what it costs is one attempt against the
   * TOTP ceiling, which is a separate row from the backup-code one, and a
   * refusal the next keystrokes replace. What it must not cost is the code:
   * nothing typed is lost, and the button still posts the whole of it.
   */
  it("fires once on a hyphen-less code whose first six are digits, and keeps the rest", async () => {
    const user = userEvent.setup();
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "234567AB");

    await waitFor(() => expect(verifyCode).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox", { name: CODE_LABEL })).toHaveValue("234567AB");

    await user.click(screen.getByRole("button", { name: SUBMIT_BUTTON }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledTimes(2));
    expect(formDataOf(verifyCode).get("code")).toBe("234567AB");
  });

  /** A refused code sitting in the field does not resubmit itself. */
  it("auto-submits one completed code once", async () => {
    const user = userEvent.setup();
    verifyCode.mockResolvedValue({ serverError: REFUSED });
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "123456");

    await waitFor(() => expect(screen.getByText(REFUSED.message)).toBeTruthy());
    expect(verifyCode).toHaveBeenCalledTimes(1);
  });
});

describe("what each outcome says", () => {
  /**
   * **A wrong code says only that it was wrong.** Never which factor, never
   * whether the challenge or the Account was the part that failed, never how
   * many attempts remain — a counter is a countdown an attacker reads. The
   * sentence is `@repo/domain`'s, built once for six different failures, and
   * this asserts that the surface renders it rather than composing a seventh.
   */
  it("renders the door's one sentence for a refused code, and keeps what was typed", async () => {
    const user = userEvent.setup();
    verifyCode.mockResolvedValue({ serverError: REFUSED });
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "123456");

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(REFUSED.message));
    // A code that failed to submit must not have to be retyped.
    expect(screen.getByRole("textbox", { name: CODE_LABEL })).toHaveValue("123456");
    // And the field stays usable: the lockout below is the only state where
    // anything is taken away, and it takes nothing away either.
    expect(screen.getByRole("textbox", { name: CODE_LABEL })).not.toBeDisabled();
  });

  /**
   * **The lockout names the wait and says a printed code still works.** That
   * second half is only true because the two ceilings are separate rows, which
   * is an implementation consequence rather than a copy choice — exhausting the
   * six digits leaves the ten printed codes untouched.
   */
  it("renders the ceiling's own sentence, and the wait as a number too", async () => {
    const user = userEvent.setup();
    verifyCode.mockResolvedValue({ serverError: LOCKED });
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "123456");

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(LOCKED.message));
    expect(screen.getByRole("status").textContent).toContain("respaldo");
    expect(screen.getByRole("status").querySelector("time")?.getAttribute("datetime")).toBe(
      "PT900S",
    );
    // The field stays enabled, because a printed code is still a thing to type.
    expect(screen.getByRole("textbox", { name: CODE_LABEL })).not.toBeDisabled();
  });

  /**
   * **Focus moves to what happened, not to where to fix it.** A screen-reader
   * user dropped straight back into the field hears the field and has to go
   * looking for the reason it is still there.
   */
  it("moves focus to the message region on an outcome", async () => {
    const user = userEvent.setup();
    verifyCode.mockResolvedValue({ serverError: REFUSED });
    render(<CodeForm />);

    await user.type(screen.getByRole("textbox", { name: CODE_LABEL }), "123456");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("status")));
  });

  it("says nothing at all before anything has been submitted", () => {
    render(<CodeForm />);

    expect(screen.getByRole("status").textContent).toBe("");
  });
});

/**
 * The ordering between three outcomes, which is a rule rather than a wiring and
 * is the part that would break silently.
 */
describe("feedbackFor", () => {
  it("says nothing until something has come back", () => {
    expect(feedbackFor({})).toBeUndefined();
  });

  it("renders the door's sentence for a refusal", () => {
    expect(feedbackFor({ serverError: REFUSED })).toEqual({
      message: REFUSED.message,
      retryAfter: undefined,
    });
  });

  it("carries the ceiling's seconds through", () => {
    expect(feedbackFor({ serverError: LOCKED })?.retryAfter).toBe(900);
  });

  /**
   * **A fault is told apart from a refused code by the code the projection fell
   * back to**, which is exactly the thing that means "this sentence is not
   * ours". Rendering it would put `DEFAULT_USER_MESSAGE` — English — in front of
   * an Admin, and would tell somebody holding a correct code that their code was
   * wrong.
   */
  it("substitutes this surface's own sentence for a fault", () => {
    expect(
      feedbackFor({
        serverError: {
          code: GENERIC_ERROR_CODE,
          message: "Something went wrong. Please try again.",
          requestId: "",
        },
      }),
    ).toEqual({ message: CONTINUE_FAILED });
  });

  // The form cannot produce one: the boundary asks only for a string and the
  // field is `required`. So reaching this is a request the form did not make.
  it("treats a validation error as a fault rather than a field error", () => {
    expect(feedbackFor({ validationErrors: { code: { _errors: ["x"] } } })).toEqual({
      message: CONTINUE_FAILED,
    });
  });
});

/** The `FormData` the action was last called with. React passes it second. */
function formDataOf(action: { mock: { calls: unknown[][] } }): FormData {
  return action.mock.calls.at(-1)?.[1] as FormData;
}
