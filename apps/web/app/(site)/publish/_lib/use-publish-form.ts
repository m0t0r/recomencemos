"use client";

/**
 * The TanStack Form instance, in one place so the three layouts share one
 * shape of field state and one set of defaults.
 *
 * It owns field values, touched state and client-side validation — and
 * nothing about submission, which stays with the native `<form action>`
 * (ADR-0014). The validators are the schemas themselves, handed over per field
 * where each is rendered, so the check she gets instantly and the check that
 * decides are the same objects.
 */

import { useForm } from "@tanstack/react-form";
import type { PublishProfileValues } from "./schema";

export interface PublishDefaults {
  /** The Google-door name, when there is one. Editable — prefilled is not decided. */
  readonly fullName: string;
}

/**
 * `refused` is what the server handed back with a refusal. On the hydrated
 * path the fields already hold it and these defaults are never read again; on
 * the unhydrated path the page mounts fresh from the action's result, and this
 * is what puts every value back where she typed it.
 */
export function usePublishForm(defaults: PublishDefaults, refused?: PublishProfileValues) {
  return useForm({
    defaultValues: {
      fullName: refused?.fullName ?? defaults.fullName,
      firstName: refused?.firstName ?? "",
      lastInitial: refused?.lastInitial ?? "",
      city: refused?.city ?? "",
      headline: refused?.headline ?? "",
      about: refused?.about ?? "",
      phone: refused?.phone ?? "",
      skillSlugs: (refused?.skillSlugs ?? []) as string[],
      // One empty line to start, so the section is a field rather than a
      // button; empty lines are dropped by the schema's consumer.
      workHistory: (refused && refused.workHistory.length > 0
        ? refused.workHistory
        : [""]) as string[],
    },
  });
}

export type PublishForm = ReturnType<typeof usePublishForm>;

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
