"use client";

/**
 * **One photo, from her camera roll to quarantine** — DD6 steps 1 and 2 from the
 * browser's side, shared by the two places a Worker hands one over: `/publish`'s
 * photo field and `/my-profile`'s own photo.
 *
 * Lifted out of `PhotoField` when `/my-profile` became the second surface
 * (#275), because what it holds is the part that is easy to get subtly wrong and
 * was measured into its shape: the pick token that makes overlapping picks
 * exclusive, the object-URL lifetime, and the two round trips that keep the
 * bytes out of a Server Action. Two copies of that would be two places for the
 * race to come back.
 *
 * **What it does not decide is what the key is for.** `/publish` carries it into
 * `publishProfile` as a bound argument; `/my-profile` attaches it the moment it
 * lands. Each passes its own `onPhotoKeyChange` and says its own sentences — a
 * pick that is "ready" means "saved when you publish" on one surface and "sent
 * for review" on the other.
 *
 * **The signing action is passed in rather than imported**, for
 * `use-action-form.ts`'s reason: a module in the shared layer that imported one
 * route's `"use server"` file would make every surface depend on that route.
 *
 * **Nothing here is a security control.** The downscale is a courtesy to her
 * mobile data; the ceiling is enforced by the signature on the presigned URL, and
 * the format is decided by the server-side re-encode from the bytes themselves.
 */

import { useEffect, useRef, useState } from "react";
import {
  PHOTO_TOO_LARGE,
  PHOTO_UNREADABLE,
  PHOTO_UPLOAD_FAILED,
} from "@/app/_lib/profile-form/messages";
import type { ActionError } from "@/lib/safe-action";
import { downscale, type DownscaleRefusal } from "./downscale";

/**
 * Where the picture is in its journey from her camera roll to quarantine.
 *
 * Five rather than three: `preparing` and `uploading` are separate because they
 * fail differently and because on a 5 MB phone photo the first one is a real
 * wait rather than a flash, and a single "loading" would be the sentence that
 * describes neither.
 */
export type PhotoStep =
  | { readonly step: "idle" }
  | { readonly step: "preparing" }
  | { readonly step: "uploading"; readonly previewUrl: string }
  | { readonly step: "ready"; readonly previewUrl: string; readonly photoKey: string }
  /** A refusal in place of progress. Every one is a failure: there is no removal to report. */
  | { readonly step: "said"; readonly message: string };

/** Where the browser PUTs one photo, and what the row will call it. */
export interface PhotoUploadTicket {
  readonly uploadUrl: string;
  readonly photoKey: string;
}

/** `createPhotoUpload`, as this hook needs it: signed, or refused with a sentence. */
export type SignPhotoUpload = (input: {
  readonly byteLength: number;
  readonly contentType: string;
}) => Promise<
  | {
      readonly data?: PhotoUploadTicket | undefined;
      readonly serverError?: ActionError | undefined;
    }
  | undefined
>;

export interface PhotoUploadOptions {
  readonly signUpload: SignPhotoUpload;
  /**
   * Every change to the key that counts: `null` the moment a new pick starts,
   * and the key once its bytes are in the store. A pick another pick overtook
   * never reaches this at all.
   */
  readonly onPhotoKeyChange: (photoKey: string | null) => void;
}

export interface PhotoUpload {
  readonly state: PhotoStep;
  /** The picture she picked, while there is one to show. */
  readonly previewUrl: string | null;
  /** Preparing or uploading: the control is inert until it settles. */
  readonly busy: boolean;
  readonly pick: (file: File | undefined) => Promise<void>;
}

const REFUSALS: Record<DownscaleRefusal, string> = {
  unreadable: PHOTO_UNREADABLE,
  "too-large": PHOTO_TOO_LARGE,
};

export function usePhotoUpload({ signUpload, onPhotoKeyChange }: PhotoUploadOptions): PhotoUpload {
  const [state, setState] = useState<PhotoStep>({ step: "idle" });

  /**
   * **Which pick is still the one that counts.**
   *
   * She may pick five photos before she likes one, and each pick is two awaits
   * deep — a downscale and a signed upload. Nothing made them exclusive, so two
   * overlapping picks raced and the *slower* one won: its `onPhotoKeyChange` was
   * the value that counted, and the picture on screen was the other one.
   *
   * A monotonic token is enough because the loser has nothing to undo — the
   * object it uploaded is an unattached quarantine key, which is the state an
   * abandoned upload already leaves.
   */
  const pickToken = useRef(0);

  /**
   * **An object URL is a document-lifetime allocation, not a value.** Each
   * preview holds the decoded blob alive until it is revoked, so the previous
   * one is released whenever this one changes, and the last one on unmount.
   */
  const previewUrl = "previewUrl" in state ? state.previewUrl : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function pick(file: File | undefined) {
    if (!file) return;

    const token = ++pickToken.current;
    const current = () => token === pickToken.current;

    onPhotoKeyChange(null);
    setState({ step: "preparing" });

    const prepared = await downscale(file);

    if (!current()) return;

    if (!prepared.ok) {
      setState({ step: "said", message: REFUSALS[prepared.reason] });
      return;
    }

    const { blob, contentType, byteLength, previewUrl: preview } = prepared.photo;
    setState({ step: "uploading", previewUrl: preview });

    /**
     * **Two round trips, and the first one is the only one that is ours.**
     * `createPhotoUpload` charges NFR26's ceiling and signs a URL; the PUT then
     * goes straight to the object store, which is DD6's correction — a multipart
     * Server Action would hit Next's 1 MB body limit and buffer the bytes in a
     * process with a 1 GB floor.
     */
    const signed = await signUpload({ byteLength, contentType });

    if (!current()) {
      URL.revokeObjectURL(preview);
      return;
    }

    if (!signed?.data) {
      // The ceiling's own sentence, or a store that is not configured. Both come
      // back as a returned refusal with copy already written for her.
      setState({ step: "said", message: signed?.serverError?.message ?? PHOTO_UPLOAD_FAILED });
      URL.revokeObjectURL(preview);
      return;
    }

    try {
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        body: blob,
        // All three are covered by the signature, so a mismatch is a refusal
        // from the store rather than something this code has to check — and
        // `If-None-Match` is not optional politeness: it is a *signed* header,
        // so dropping it invalidates the signature. It is what makes the URL a
        // single write rather than a five-minute window in which the object an
        // Admin reviewed can be swapped for another. See `presignUpload`.
        headers: { "Content-Type": contentType, "If-None-Match": "*" },
      });

      if (!response.ok) throw new Error(String(response.status));

      if (!current()) {
        URL.revokeObjectURL(preview);
        return;
      }

      setState({ step: "ready", previewUrl: preview, photoKey: signed.data.photoKey });
      onPhotoKeyChange(signed.data.photoKey);
    } catch {
      if (!current()) {
        URL.revokeObjectURL(preview);
        return;
      }

      setState({ step: "said", message: PHOTO_UPLOAD_FAILED });
      URL.revokeObjectURL(preview);
    }
  }

  return {
    state,
    previewUrl,
    busy: state.step === "preparing" || state.step === "uploading",
    pick,
  };
}
