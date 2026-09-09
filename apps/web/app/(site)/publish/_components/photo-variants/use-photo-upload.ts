"use client";

/**
 * The upload machine, lifted out of `photo-field.tsx` so three layouts can
 * disagree about everything except what a pick *does*.
 *
 * **Sharing this is not the anti-pattern the skill warns about.** A shared
 * `<Layout>` would defeat the prototype; a shared downscale-presign-PUT is the
 * part the question is not about. Each variant below owns its markup entirely —
 * its affordance, its hierarchy, whether a preview and a trigger are one object
 * or three.
 *
 * Throwaway. `photo-field.tsx` keeps the real copy of this.
 */

import { useEffect, useRef, useState } from "react";
import { createPhotoUpload } from "../../actions";
import { downscale, type DownscaleRefusal } from "../../_lib/downscale";
import {
  PHOTO_PREPARING,
  PHOTO_READY,
  PHOTO_REMOVED,
  PHOTO_TOO_LARGE,
  PHOTO_UNREADABLE,
  PHOTO_UPLOAD_FAILED,
  PHOTO_UPLOADING,
} from "@/app/_lib/profile-form/messages";

export type PhotoStep =
  | { readonly step: "idle" }
  | { readonly step: "preparing" }
  | { readonly step: "uploading"; readonly previewUrl: string }
  | { readonly step: "ready"; readonly previewUrl: string; readonly photoKey: string }
  | { readonly step: "said"; readonly message: string; readonly tone: "error" | "note" };

const REFUSALS: Record<DownscaleRefusal, string> = {
  unreadable: PHOTO_UNREADABLE,
  "too-large": PHOTO_TOO_LARGE,
};

export function usePhotoUpload(onPhotoKeyChange: (photoKey: string | null) => void) {
  const [state, setState] = useState<PhotoStep>({ step: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const pickToken = useRef(0);

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
      setState({ step: "said", message: REFUSALS[prepared.reason], tone: "error" });
      return;
    }

    const { blob, contentType, byteLength, previewUrl: preview } = prepared.photo;
    setState({ step: "uploading", previewUrl: preview });

    const signed = await createPhotoUpload({ byteLength, contentType });
    if (!current()) {
      URL.revokeObjectURL(preview);
      return;
    }

    if (!signed?.data) {
      setState({
        step: "said",
        message: signed?.serverError?.message ?? PHOTO_UPLOAD_FAILED,
        tone: "error",
      });
      URL.revokeObjectURL(preview);
      return;
    }

    try {
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        body: blob,
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
      setState({ step: "said", message: PHOTO_UPLOAD_FAILED, tone: "error" });
      URL.revokeObjectURL(preview);
    }
  }

  function remove() {
    pickToken.current += 1;
    onPhotoKeyChange(null);
    setState({ step: "said", message: PHOTO_REMOVED, tone: "note" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const announcement =
    state.step === "preparing"
      ? PHOTO_PREPARING
      : state.step === "uploading"
        ? PHOTO_UPLOADING
        : state.step === "ready"
          ? PHOTO_READY
          : state.step === "said"
            ? state.message
            : "";

  return {
    state,
    previewUrl,
    announcement,
    busy: state.step === "preparing" || state.step === "uploading",
    inputRef,
    pick,
    remove,
  };
}
