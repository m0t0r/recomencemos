"use client";

/**
 * PROTOTYPE — the real machine behind all three layouts. Throwaway.
 *
 * It is `code-form.tsx`'s hooks, unchanged, so each variant is judged against
 * the real Server Action, a real challenge and the real refusals: a wrong code
 * refuses, six digits auto-submit, and a correct one lands in the queue. The
 * only thing `?variant=` changes is which layout renders.
 */

import { GENERIC_ERROR_CODE } from "@repo/errors/app-error";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { verifyCode } from "../../actions";
import { CONTINUE_FAILED } from "../../_lib/messages";
import { isCompleteTotpCode } from "../../_lib/schema";
import { PrototypeSwitcher } from "./switcher";
import { VARIANTS, type VariantKey } from "./variants";

type VerifyResult = Awaited<ReturnType<typeof verifyCode>>;

const INITIAL: VerifyResult = {};

export function PrototypeForm({ variant }: { readonly variant: VariantKey }) {
  const [code, setCode] = useState("");
  const [result, formAction, pending] = useActionState(verifyCode, INITIAL);

  const codeId = useId();
  const descriptionId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);
  const autoSubmitted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isCompleteTotpCode(code)) {
      autoSubmitted.current = undefined;
      return;
    }
    if (autoSubmitted.current === code) return;

    autoSubmitted.current = code;
    formRef.current?.requestSubmit();
  }, [code]);

  useEffect(() => {
    if (result.serverError ?? result.validationErrors) announcementRef.current?.focus();
  }, [result]);

  const error = result.serverError;
  const message = error
    ? error.code === GENERIC_ERROR_CODE
      ? CONTINUE_FAILED
      : error.message
    : result.validationErrors
      ? CONTINUE_FAILED
      : undefined;

  const Layout = VARIANTS[variant];

  return (
    <>
      <Layout
        codeId={codeId}
        descriptionId={descriptionId}
        value={code}
        onChange={setCode}
        pending={pending}
        region={
          <div
            ref={announcementRef}
            tabIndex={-1}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="status"
            className={
              message
                ? "border-destructive/30 bg-destructive/5 rounded-lg border p-4"
                : "sr-only"
            }
          >
            {message ? <p className="text-foreground text-base leading-6">{message}</p> : null}
          </div>
        }
        formProps={{
          ref: formRef,
          action: formAction,
          onSubmit: (event) => {
            const formData = new FormData(event.currentTarget);
            event.preventDefault();
            startTransition(() => formAction(formData));
          },
        }}
      />
      <PrototypeSwitcher current={variant} />
    </>
  );
}
