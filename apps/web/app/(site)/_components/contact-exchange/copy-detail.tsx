"use client";

/**
 * One detail's _Copiar_ control, beside it on the card.
 *
 * **An enhancement, never the only way.** The detail beside it is selectable
 * text with or without JavaScript, so a phone that never hydrates loses the
 * shortcut and nothing else — and a clipboard the browser refuses (an insecure
 * origin, a permission asked and declined) changes nothing on the screen: the
 * text she needs is still there to hold down and copy.
 *
 * **_Copiado_ is a moment, not a state.** It says the tap worked and then goes
 * back to _Copiar_ after {@link COPIED_FOR_MS}; a button stuck on _Copiado_
 * would say nothing about a second tap, or about which of the three she copied
 * last. A second tap inside the window restarts it.
 *
 * **What is copied is the stored value, not the displayed one.** The phone is
 * shown as `300 123 4567` and copied as `+573001234567`: he may be anywhere, and
 * a number pasted into a dialler abroad without its country code reaches nobody.
 *
 * **The visible word is _Copiar_ and the accessible name adds which detail**, so
 * a screen-reader user hears three different buttons rather than one word three
 * times, and the visible word is still inside the name (WCAG 2.5.3).
 */

import { Button } from "@repo/design-system/components/button";
import { useEffect, useRef, useState } from "react";
import { COPIED, COPY_DETAIL, copiedName } from "./messages";

/** How long _Copiado_ stays before the button reads _Copiar_ again. */
export const COPIED_FOR_MS = 2000;

export function CopyDetail({ value, label }: { readonly value: string; readonly label: string }) {
  const [copied, setCopied] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A button that unmounts inside the window leaves no timer behind.
  useEffect(() => () => clearTimeout(reset.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Refused: the detail is still selectable text beside this button.
      return;
    }

    setCopied(true);
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={copy}
      // _Correo copiado_ for the moment; _Copiar correo_ from the text otherwise.
      aria-label={copied ? copiedName(label) : undefined}
    >
      {copied ? COPIED : COPY_DETAIL}
      {copied ? null : <span className="sr-only"> {label.toLowerCase()}</span>}
    </Button>
  );
}
