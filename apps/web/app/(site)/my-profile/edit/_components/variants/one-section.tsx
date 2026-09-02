"use client";

/**
 * **B — Una sección a la vez.** The four groups as a disclosure list: the one
 * she came to change is open, the other three are closed headings she can open.
 * One save, at the end, writing the whole profile as before.
 *
 * Its case: on a phone she sees the field she came for and nothing else, and
 * `/my-profile`'s per-section links land her on it directly. It is the brief's
 * "one page per group" answered without a second route and without bound
 * arguments — the fields of a closed section are still in the form, so the
 * whole profile still posts and the spec's whole-profile write is untouched.
 *
 * Against it: a closed section hides a field she has already broken. A refusal
 * on a field inside a closed group would announce a problem she cannot see, so
 * this variant opens **every group that carries a server error** — which is the
 * part a reviewer should push on hardest, because it means the page can look
 * different after a refusal than it did before.
 *
 * **`<details>` rather than a registry component, deliberately.** The registry
 * has no accordion, and a native disclosure keeps its sections' inputs in the
 * form while closed and works with no JavaScript at all — the two properties
 * this variant is standing on.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import {
  CapabilityGroup,
  ContactGroup,
  FIELD_GROUP_IDS,
  IdentityGroup,
  MoreGroup,
} from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import {
  CAPABILITY_LEGEND,
  CONTACT_LEGEND,
  FEEDBACK_REGION_LABEL,
  IDENTITY_LEGEND,
  MORE_LEGEND,
} from "@/app/_lib/profile-form/messages";
import Link from "next/link";
import type { ComponentType } from "react";
import { BACK_TO_PROFILE, PHOTO_CHANGED_ELSEWHERE, SAVE_BUTTON } from "../../_lib/messages";
import type { VariantProps } from ".";

/** Which fields sit in which group, so a refusal can open the group holding it. */
const FIELDS_IN_GROUP = {
  capability: ["skillSlugs", "headline"],
  identity: ["firstName", "lastInitial", "city", "fullName"],
  contact: ["phone"],
  more: ["about", "workHistory"],
} as const;

const SECTIONS = [
  { id: FIELD_GROUP_IDS.capability, legend: CAPABILITY_LEGEND, Group: CapabilityGroup },
  { id: FIELD_GROUP_IDS.identity, legend: IDENTITY_LEGEND, Group: IdentityGroup },
  { id: FIELD_GROUP_IDS.contact, legend: CONTACT_LEGEND, Group: ContactGroup },
  { id: FIELD_GROUP_IDS.more, legend: MORE_LEGEND, Group: MoreGroup },
] as const satisfies readonly {
  id: string;
  legend: string;
  Group: ComponentType<VariantProps & { photoNote?: React.ReactNode }>;
}[];

export function OneSection(props: VariantProps) {
  const { machine, idFor, serverErrorFor, openGroup } = props;

  const refused = (id: keyof typeof FIELDS_IN_GROUP) =>
    FIELDS_IN_GROUP[id].some((field) => serverErrorFor(field) !== undefined);

  return (
    <FieldGroup>
      {SECTIONS.map(({ id, legend, Group }) => (
        <details
          key={id}
          id={`section-${id}`}
          open={id === (openGroup ?? FIELD_GROUP_IDS.capability) || refused(id)}
          className="border-border rounded-md border px-4 py-3"
        >
          <summary className="focus-visible:ring-ring text-foreground cursor-pointer rounded-sm py-1 font-semibold focus-visible:ring-2 focus-visible:outline-none">
            {legend}
          </summary>
          {/*
            The group carries its own legend and the summary above it says the
            same words, so the legend is left for a screen reader and taken off
            the screen — a heading rendered twice reads as two sections.
          */}
          <div className="pt-4 [&>fieldset>legend]:sr-only">
            <Group
              {...props}
              photoNote={
                <p className="text-muted-foreground text-sm text-pretty">
                  {PHOTO_CHANGED_ELSEWHERE}
                </p>
              }
            />
          </div>
        </details>
      ))}

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {SAVE_BUTTON}
      </Button>

      <Link
        href="/my-profile"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {BACK_TO_PROFILE}
      </Link>
    </FieldGroup>
  );
}
