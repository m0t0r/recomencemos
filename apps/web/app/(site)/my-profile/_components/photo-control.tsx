"use client";

/**
 * **Her photo on her own page, and the way to change it** — `PhotoPicker`, the
 * one component for her photo on every surface (#275), with this page's half:
 *
 * - **The picture is there before she picks one.** Her current photo — approved,
 *   or her own pending one, which only this page shows — is the control from the
 *   first paint; with none, her initial is. So the control is always the
 *   picture, never a button that becomes one.
 * - **It commits the moment the upload lands**, through `changePhoto`, because
 *   there is no submit for the key to wait for. The page re-reads, and the
 *   sentence under her card says a person is looking at it.
 *
 * It computes its own hydration flag because this page has no form machine to
 * borrow one from; the probe is the same `useSyncExternalStore` one.
 */

import { useSyncExternalStore } from "react";
import { PhotoPicker } from "@/app/_lib/photo/photo-picker";
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
  // Never said: this surface always commits, so it says the two below instead.
  ready: PHOTO_ATTACHING,
  committing: PHOTO_ATTACHING,
  committed: PHOTO_ATTACHED,
  needsJavaScript: PHOTO_CONTROL_NOTE,
} as const;

async function commit(photoKey: string): Promise<string | undefined> {
  const result = await changePhoto({ photoKey });
  return result?.data ? undefined : (result?.serverError?.message ?? PHOTO_ATTACH_FAILED);
}

export interface PhotoControlProps {
  /** Her photo as this page resolves it — approved, or her own pending one. */
  readonly currentUrl: string | null;
  /** What stands in for it: her initial. */
  readonly initial: string;
  /** The sentence carrying the photo's state, announced with the control. */
  readonly describedBy?: string;
  readonly size?: "sm" | "md" | "lg";
}

export function PhotoControl({ currentUrl, initial, describedBy, size }: PhotoControlProps) {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return (
    <PhotoPicker
      sentences={SENTENCES}
      hydrated={hydrated}
      signUpload={createPhotoUpload}
      currentUrl={currentUrl}
      placeholder={initial}
      commit={commit}
      {...(describedBy ? { describedBy } : {})}
      {...(size ? { size } : {})}
    />
  );
}
