"use client";

/**
 * The one control on this page.
 *
 * **A clipboard button, and nothing else.** No print view and no download, and
 * both were considered rather than forgotten — the surface brief records the
 * decision and asks a later reviewer to read it before adding one. What follows
 * from it is on the screen beside this button: pointing the codes at a password
 * manager is fine on one condition, which is that the manager is not the one
 * holding the mailbox's password, because the mailbox is the other factor.
 *
 * **It is the only client component here.** Everything else — the QR, the manual
 * secret, the ten codes — is server-rendered text, so losing JavaScript costs
 * this button and not the enrolment. That is NFR4's shape applied to a page with
 * no form on it.
 */

import { Button } from "@repo/design-system/components/button";
import * as React from "react";
import { COPY_CODES, COPY_CODES_DONE, COPY_CODES_FAILED } from "../_lib/messages";

/**
 * Three states, and the failing one is real rather than defensive.
 *
 * `navigator.clipboard` is absent on an insecure origin and refuses on a denied
 * permission or an old browser. A button that silently did nothing there would
 * be the worst version of this screen: the person believes they have the codes.
 */
type CopyState = "ready" | "copied" | "failed";

export function CopyCodes({ codes }: { readonly codes: readonly string[] }) {
  const [state, setState] = React.useState<CopyState>("ready");

  async function copy() {
    try {
      /**
       * **Plain, newline-separated, with no header and no decoration**, so it
       * pastes cleanly into whatever holds it. A label above the codes would
       * arrive in a password manager's secure note as a line to delete.
       */
      await navigator.clipboard.writeText(codes.join("\n"));
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={copy} className="self-start">
        {COPY_CODES}
      </Button>

      {/*
        **Announced, not just drawn.** A confirmation that only changes pixels is
        a confirmation a screen-reader user does not get, and this is the control
        that tells somebody whether they still have ten codes. The region is in
        the markup from the first render rather than mounted on success — a live
        region inserted at the same moment as its text is frequently not
        announced at all.

        **An `<output>`, not a `<p aria-live="polite">`** — which is what this
        was, and which the test next door caught. `aria-live` is a property, not
        a role: it changes how a change is announced and puts nothing in the
        accessibility tree, so the region was reachable by a CSS selector and by
        nothing a screen-reader user has. `<output>` has the `status` role
        implicitly, with the polite live semantics that come with it, so the
        assertion is `getByRole("status")` rather than a `querySelector` nobody
        would question. It is also the element the lint rule asks for over a
        hand-written `role`.
      */}
      <output className="text-muted-foreground block min-h-5 text-sm">
        {state === "copied" && COPY_CODES_DONE}
        {state === "failed" && COPY_CODES_FAILED}
      </output>
    </div>
  );
}
