"use client";

/**
 * **Her card on her own page, whose photo is the control that changes it** —
 * and the control's own lines, below the card rather than inside it.
 *
 * It is the one photo component on every surface (#275, the owner's rule),
 * placed in two parts through `usePhotoPicker`: the circle goes into the card's
 * photo slot, where her photo is, and its progress and refusal go underneath,
 * where a sentence has room. The card's header has none: a progress line there
 * would push her headline sideways, and at 390 px out of the card.
 *
 * **This page's half of the control:**
 *
 * - **The picture is there before she picks one.** Her current photo — approved,
 *   or her own pending one, which only this page shows — is the control from the
 *   first paint; with none, her initial is.
 * - **It commits the moment the upload lands**, through `changePhoto`, because
 *   there is no submit for the key to wait for. The page re-reads, and the
 *   sentence under her card says a person is looking at it.
 *
 * A Client Component because the control is. `ProfileCard` is presentational and
 * renders the same from here as from a Server Component. It computes its own
 * hydration flag because this page has no form machine to borrow one from; the
 * probe is the same `useSyncExternalStore` one.
 */

import type { VocabularyEntry } from "@repo/domain/skills";
import * as React from "react";
import { usePhotoPicker } from "@/app/_components/photo/photo-picker";
import { initialOf, ProfileCard } from "@/app/(site)/_components/profile-card";
// The signing action is `/publish`'s, and there is one: a second endpoint that
// signs uploads would be a second ceiling to keep in step with the first.
import { createPhotoUpload } from "@/app/(site)/publish/actions";
import { changePhoto } from "../actions";
import {
  PHOTO_ATTACH_FAILED,
  PHOTO_ATTACHED,
  PHOTO_ATTACHING,
  PHOTO_CONTROL_ADD,
  PHOTO_CONTROL_CHANGE,
  PHOTO_CONTROL_NOTE,
} from "../_lib/messages";

const subscribeToNothing = () => () => {};

const SENTENCES = {
  choose: PHOTO_CONTROL_ADD,
  replace: PHOTO_CONTROL_CHANGE,
  committing: PHOTO_ATTACHING,
  committed: PHOTO_ATTACHED,
  needsJavaScript: PHOTO_CONTROL_NOTE,
} as const;

async function commit(photoKey: string): Promise<string | undefined> {
  const result = await changePhoto({ photoKey });
  return result?.data ? undefined : (result?.serverError?.message ?? PHOTO_ATTACH_FAILED);
}

export interface OwnCardProps {
  readonly firstName: string;
  readonly lastInitial: string;
  readonly cityLabel: string;
  readonly headline: string;
  readonly skills: readonly VocabularyEntry[];
  /** Her photo as this page resolves it — approved, or her own pending one. */
  readonly photoUrl: string | null;
  /** The sentence carrying the photo's state, when there is one, announced with the control. */
  readonly describedBy?: string;
}

export function OwnCard({
  firstName,
  lastInitial,
  cityLabel,
  headline,
  skills,
  photoUrl,
  describedBy,
}: OwnCardProps) {
  const hydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const photo = usePhotoPicker({
    sentences: SENTENCES,
    hydrated,
    signUpload: createPhotoUpload,
    currentUrl: photoUrl,
    placeholder: initialOf(firstName),
    commit,
    ...(describedBy ? { describedBy } : {}),
    size: "sm",
  });

  return (
    <>
      <ProfileCard
        firstName={firstName}
        lastInitial={lastInitial}
        cityLabel={cityLabel}
        headline={headline}
        skills={skills}
        photoSlot={photo.control}
      />
      <div className="flex flex-col gap-1">{photo.messages}</div>
    </>
  );
}
