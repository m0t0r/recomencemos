/**
 * What a form would post, asked of the browser rather than of the markup (#261).
 *
 * A test reaches a form from a control the accessibility tree found — a submit
 * button, a textbox — because a `<form>` with no accessible name has no role of
 * its own. `control.form` is the form a native submit from that control posts,
 * resolving a `form` attribute exactly as the browser does, and `FormData` over
 * it is what that submit would send: a hidden input is a key nobody typed, and
 * an unchosen radio or checkbox is absent.
 *
 * These live here rather than beside each test so a control in no form fails one
 * way everywhere — by throwing, and naming the control — instead of one file
 * answering `null` and the next throwing.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

type FormControl = HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement;

/** The form a native submit from this control posts. */
export function formOf(control: FormControl): HTMLFormElement {
  if (control.form === null) {
    throw new Error(`The control "${control.name || control.textContent}" sits in no form.`);
  }
  return control.form;
}

/** What a native submit from this control would send. */
export function submittedFrom(control: FormControl): FormData {
  return new FormData(formOf(control));
}

/** The names a native submit from this control would send, in document order. */
export function fieldNamesFrom(control: FormControl): string[] {
  return [...submittedFrom(control).keys()];
}

const TEST_FORM = "formulario de prueba";

/**
 * For a component with no form of its own: rendered inside a named one, so the
 * accessibility tree hands the form back by role, and that form returned.
 */
export function renderInForm(ui: ReactNode): HTMLFormElement {
  render(<form aria-label={TEST_FORM}>{ui}</form>);
  return screen.getByRole<HTMLFormElement>("form", { name: TEST_FORM });
}
