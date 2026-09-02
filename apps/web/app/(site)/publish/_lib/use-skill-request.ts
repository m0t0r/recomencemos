"use client";

/**
 * The Skill request's machine — what the picker's last option *does*, kept apart
 * from what it looks like, exactly as `use-publish.ts` is kept apart from
 * `publish-layout.tsx`.
 *
 * **It is a second `useActionState` on a page that already has one, and never a
 * second `<form>`.** A `<form>` cannot nest inside a `<form>`, and the publishing
 * form is the element she is standing in — so the request is dispatched by hand
 * with a `FormData` this hook builds. That is the same dispatch `usePublish`
 * makes for its own submit, and for an overlapping reason: React resets a form
 * whose `action` settles, and a reset here would clear the Base UI checkboxes
 * behind the Skill picker while the styled controls still read as ticked.
 *
 * **`.stateAction()` + `useActionState`, never `useAction`** (ADR-0015). The
 * request has no unhydrated path to protect — the picker only renders this
 * affordance once hydrated — but the rule holds anyway: a page with two action
 * idioms is a page where the next person picks the wrong one.
 *
 * **The outcome is three states and one of them is not an error.** Sent, refused
 * with a sentence, and in flight. A ceiling is the interesting case: it arrives
 * as a refusal carrying `retryAfter`, and its sentence — the one the spec singles
 * out, because she meets it mid-publish — is already written by the domain and
 * needs only rendering.
 */

import { startTransition, useActionState, useState } from "react";
import { SESSION_REQUIRED_CODE } from "@/app/_lib/session/codes";
import type { ActionError } from "@/lib/safe-action";
import { requestSkill } from "../actions";
import { SKILL_REQUEST_FAILED, SKILL_REQUEST_SENT } from "./messages";
import { SKILL_REQUEST_REFUSED_CODE } from "./codes";
import { skillRequestFields } from "./schema";

export type SkillRequestResult = Awaited<ReturnType<typeof requestSkill>>;

const INITIAL: SkillRequestResult = {};

/** What the region beside the field says, and whether it is an answer or a refusal. */
export interface SkillRequestNotice {
  readonly message: string;
  readonly refused: boolean;
}

export interface SkillRequestMachine {
  /** Whether the request is in flight, so the button can say so. */
  readonly pending: boolean;
  /** What to announce, or nothing yet. */
  readonly notice: SkillRequestNotice | undefined;
  /** Whether the field should be cleared — it landed, so what was in it is gone. */
  readonly sent: boolean;
  /** Send what she typed. Validated here first, so an empty field costs no round trip. */
  readonly send: (text: string) => void;
  /** The client-side verdict on the field, when there is one. */
  readonly fieldError: string | undefined;
}

export function useSkillRequest(): SkillRequestMachine {
  const [result, dispatch, pending] = useActionState(requestSkill, INITIAL);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  function send(text: string) {
    const parsed = skillRequestFields.safeParse({ text });

    if (!parsed.success) {
      // The same sentence the server would answer with, without the trip.
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);

    const formData = new FormData();
    formData.set("text", parsed.data.text);
    startTransition(() => dispatch(formData));
  }

  return {
    pending,
    notice: noticeFor(result),
    sent: result.data?.requested === true,
    send,
    fieldError,
  };
}

/**
 * What the region says, or nothing.
 *
 * **A ceiling, a rejected fragment and an expired session all arrive as
 * `serverError`, and all three carry their own sentence** — one written by
 * NFR26's refusal table, one by the surface's `contactDetailRefusal`, one by the
 * domain. None is rewritten here: each says something the others cannot, and the
 * first two are refusals a person provokes on purpose. Anything else is a fault,
 * and the fault's sentence is ours rather than whatever the transport produced.
 *
 * Exported for its own test — it is the one rule in this module rather than a
 * wiring.
 */
export function noticeFor(result: {
  readonly data?: { readonly requested: true } | undefined;
  readonly serverError?: ActionError | undefined;
}): SkillRequestNotice | undefined {
  if (result.serverError) {
    const { code, message, retryAfter } = result.serverError;
    const spoken =
      retryAfter !== undefined ||
      code === SKILL_REQUEST_REFUSED_CODE ||
      code === SESSION_REQUIRED_CODE;

    return { message: spoken ? message : SKILL_REQUEST_FAILED, refused: true };
  }

  return result.data?.requested ? { message: SKILL_REQUEST_SENT, refused: false } : undefined;
}
