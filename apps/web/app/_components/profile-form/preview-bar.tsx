"use client";

/**
 * **Prototype only** — the `thumb` position of the preview: the card and the
 * one action, in a bar stuck to the bottom of the viewport where a thumb
 * reaches without scrolling back up a form that is fifteen fields long.
 *
 * **It is a `<details>` and not a state**, which is the whole reason this
 * position is buildable at all: the disclosure works with no JavaScript, it is
 * a standard affordance rather than a novel one, and the `<summary>` is a real
 * focus stop in the tab order rather than a `<div>` with a handler on it.
 *
 * **The summary is her own line, in the display face** — collapsed, the bar
 * carries the one thing on the page nobody else could have written, and opening
 * it shows the whole card. Before she has written a line it says what will
 * appear there instead.
 *
 * **The submit lives here in this position and nowhere else.** `edit-profile.md`
 * left "is the save control sticky on a phone" open for the human; a bar that
 * carried the preview and left the action at the end of the form would answer
 * that question badly in both directions — two places to look for the outcome,
 * and a control the bar covers.
 *
 * The shadow is `DESIGN.md`'s: this genuinely floats over content passing
 * beneath it, which is one of the four cases that file allows a shadow for.
 */

import { Button } from "@repo/design-system/components/button";
import { PREVIEW_EMPTY, PREVIEW_HEADING } from "@/app/_lib/profile-form/messages";
import type { ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import type { ProfileFormMachine } from "@/app/_lib/profile-form/use-profile-form";
import type { VocabularyEntry } from "./skill-picker";
import { ProfilePreview } from "./preview";

export interface PreviewBarProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  /** The verb of this surface's action. */
  readonly submitLabel: string;
}

export function PreviewBar({ form, machine, vocabulary, submitLabel }: PreviewBarProps) {
  return (
    <div className="bg-background border-border sticky bottom-0 z-30 -mx-4 flex flex-col gap-3 border-t px-4 pt-3 pb-4 shadow-[0_-6px_16px_-8px_rgb(0_0_0/0.15)] sm:-mx-6 sm:px-6">
      <details className="group/preview">
        <summary className="marker:text-muted-foreground focus-visible:ring-ring/50 flex cursor-pointer list-item flex-col rounded-sm py-1 pl-5 focus-visible:ring-[3px] focus-visible:outline-none">
          <span className="text-muted-foreground text-xs">{PREVIEW_HEADING}</span>
          <form.Subscribe selector={(state) => state.values.headline}>
            {(headline) =>
              headline.trim().length === 0 ? (
                <span className="text-muted-foreground text-sm text-pretty">{PREVIEW_EMPTY}</span>
              ) : (
                <span className="font-heading text-foreground line-clamp-2 text-lg leading-6 font-medium text-pretty">
                  {headline}
                </span>
              )
            }
          </form.Subscribe>
        </summary>
        <div className="pt-3">
          <ProfilePreview form={form} vocabulary={vocabulary} />
        </div>
      </details>

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {submitLabel}
      </Button>
    </div>
  );
}
