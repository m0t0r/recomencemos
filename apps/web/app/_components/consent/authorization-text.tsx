/**
 * The *autorización* as text, and the two identifiers that address it.
 *
 * **No `"use client"`, and that absence is the point.** This is static prose and
 * two constants — nothing here holds state, takes a handler or reads the DOM, so
 * it renders identically on either side of the boundary. It used to sit in
 * `authorization.tsx` beside the control, whose `"use client"` is real, and a
 * directive marks a *module*: `/privacy` is a Server Component rendering nothing
 * but this block, and it was shipping the checkbox, the field primitives and the
 * whole consent module to a browser that had nothing to do with them.
 *
 * So the file is split along what is actually interactive rather than along what
 * is about consent. `authorization.tsx` imports this and renders it above the
 * control, which is the donut `sticky-header.tsx` names: the client half owns the
 * part that holds state and the server half is passed through it.
 */

import { AUTHORIZATION_TEXT } from "@/app/_lib/consent/messages";

/** Where the full *aviso de privacidad* lives. English segment, per ADR-0012. */
export const PRIVACY_NOTICE_PATH = "/privacy";

/**
 * The anchor the *autorización* sits at, so a form can link straight to the text
 * it is showing a shortened form of.
 *
 * An `id` is an identifier, so it is English while everything rendered inside it
 * is `es-CO`.
 */
export const AUTHORIZATION_ANCHOR = "authorization";

/**
 * The *autorización*, as text.
 *
 * Rendered as separate paragraphs rather than one block: each sentence is a
 * distinct thing being authorized, and a screen reader's paragraph navigation is
 * how a person moves through a legal text she did not come here to read.
 */
export function AuthorizationText() {
  return (
    <div className="flex flex-col gap-2">
      {AUTHORIZATION_TEXT.map((paragraph) => (
        <p key={paragraph} className="text-pretty">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
