"use client";

/**
 * **C — Índice arriba, guardar siempre a la vista.** Everything open, as in A,
 * with two additions: a list of jump links to the four groups at the top, and
 * the save control pinned to the bottom of the viewport.
 *
 * Its case: on a long form on a phone, the save is reachable from wherever she
 * is, and the index at the top is a map of what the form contains — the same
 * job `/my-profile`'s per-section links do, but on the page she is already on.
 *
 * Against it: a pinned bar covers the bottom of the page, which on a small
 * screen is a field. The bar is therefore in the normal flow as well — it sits
 * at the end of the form too — so the last field is never underneath it; that
 * costs a duplicate control, which is itself a thing to judge.
 *
 * The summary stays above the pinned bar rather than inside it: focus moves
 * there on a refusal, and a focused region inside a fixed bar is a region that
 * scrolls nothing into view.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { FIELD_GROUP_IDS, ProfileFieldGroups } from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import {
  CAPABILITY_LEGEND,
  CONTACT_LEGEND,
  FEEDBACK_REGION_LABEL,
  IDENTITY_LEGEND,
  MORE_LEGEND,
} from "@/app/_lib/profile-form/messages";
import Link from "next/link";
import { BACK_TO_PROFILE, PHOTO_CHANGED_ELSEWHERE, SAVE_BUTTON } from "../../_lib/messages";
import type { VariantProps } from ".";

/** The index at the top. Prototype copy — a real one would live in a message module. */
const JUMP_LABEL = "Ir directo a";

const JUMPS = [
  { id: FIELD_GROUP_IDS.capability, legend: CAPABILITY_LEGEND },
  { id: FIELD_GROUP_IDS.identity, legend: IDENTITY_LEGEND },
  { id: FIELD_GROUP_IDS.contact, legend: CONTACT_LEGEND },
  { id: FIELD_GROUP_IDS.more, legend: MORE_LEGEND },
] as const;

export function PinnedSave({ form, machine, vocabulary, idFor, serverErrorFor }: VariantProps) {
  const save = (
    <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
      {SAVE_BUTTON}
    </Button>
  );

  return (
    <FieldGroup>
      <nav aria-label={JUMP_LABEL} className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">{JUMP_LABEL}</p>
        <ul className="flex flex-wrap gap-2">
          {JUMPS.map(({ id, legend }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="border-border text-foreground hover:bg-accent focus-visible:ring-ring inline-flex rounded-full border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {legend}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ProfileFieldGroups
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={serverErrorFor}
        photoNote={
          <p className="text-muted-foreground text-sm text-pretty">{PHOTO_CHANGED_ELSEWHERE}</p>
        }
      />

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      {save}

      <Link
        href="/my-profile"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {BACK_TO_PROFILE}
      </Link>

      {/*
        The pinned copy. `aria-hidden` with every control inside it removed from
        the tab order, because it is the same control as the one above — a
        second tab stop saying the same word is a thing a screen-reader user has
        to work out. A pointer gets a reachable save; the keyboard path is
        unchanged from A.
      */}
      <div
        aria-hidden="true"
        className="bg-background/95 border-border pointer-events-auto fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 backdrop-blur sm:hidden"
      >
        <Button type="submit" size="lg" tabIndex={-1} disabled={machine.pending} className="w-full">
          {SAVE_BUTTON}
        </Button>
      </div>
    </FieldGroup>
  );
}
