"use client";

/**
 * The TanStack Form instance, in one place so every layout that renders these
 * fields shares one shape of field state and one set of defaults.
 *
 * It owns field values, touched state and client-side validation — and
 * nothing about submission, which stays with the native `<form action>`
 * (ADR-0014). The validators are the schemas themselves, handed over per field
 * where each is rendered, so the check she gets instantly and the check that
 * decides are the same objects.
 */

import { useForm } from "@tanstack/react-form";
import type { PublishProfileValues } from "./schema";

/**
 * What the form opens with, before she types anything.
 *
 * **Partial, because the two surfaces know different amounts.** Publishing
 * knows at most the name the Google door handed over and nothing else; editing
 * knows the whole profile, because there is one. Anything absent opens empty,
 * which makes the publish case the general case rather than a special one.
 */
export type ProfileFieldDefaults = Partial<PublishProfileValues>;

/**
 * `refused` is what the server handed back with a refusal, and it outranks the
 * defaults. On the hydrated path the fields already hold it and the defaults
 * are never read again; on the unhydrated path the page mounts fresh from the
 * action's result, and this is what puts every value back where she typed it —
 * including, on an edit, over the top of what she had saved before.
 */
export function useProfileFields(defaults: ProfileFieldDefaults, refused?: PublishProfileValues) {
  const opening = refused ?? defaults;

  return useForm({
    defaultValues: {
      fullName: opening.fullName ?? "",
      firstName: opening.firstName ?? "",
      lastInitial: opening.lastInitial ?? "",
      city: opening.city ?? "",
      headline: opening.headline ?? "",
      about: opening.about ?? "",
      phone: opening.phone ?? "",
      skillSlugs: (opening.skillSlugs ?? []) as string[],
      // One empty line to start, so the section is a field rather than a
      // button; empty lines are dropped by the schema's consumer.
      workHistory:
        opening.workHistory && opening.workHistory.length > 0
          ? ([...opening.workHistory] as string[])
          : ([""] as string[]),
    },
  });
}

export type ProfileFieldsForm = ReturnType<typeof useProfileFields>;

/** The string-valued fields, which one component renders for all of them. */
export type TextFieldName = "fullName" | "firstName" | "lastInitial" | "headline" | "phone";

/**
 * TanStack reports a Standard Schema issue as `{ message }` and a string
 * validator's verdict as a string; one reader covers both.
 */
export function messageOf(errors: readonly unknown[]): string | undefined {
  const first = errors[0];
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}
