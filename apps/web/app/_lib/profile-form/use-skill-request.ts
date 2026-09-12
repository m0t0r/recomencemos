"use client";

/**
 * The Skill request's machine — what the picker's last option *does*, kept apart
 * from what it looks like, exactly as `use-profile-form.ts` is kept apart from
 * the layouts that render it.
 *
 * **It sits in the shared layer because the picker does.** Since #142 the Skill
 * picker is rendered by `/publish` and by `/my-profile/edit`, and the option it
 * ends with — *no está en la lista* — cannot mean two things on two forms: the
 * only copy that exists says the request is real, and a Worker who is editing
 * because what she does has changed is exactly the person who finds the list
 * short.
 *
 * **`requestSkill` is imported from `/publish`'s `actions.ts`, which is the one
 * cross-route import in this app and is flagged as such** (#142's pull request).
 * The action is the Skill vocabulary's rather than publishing's, so it wants a
 * home of its own; giving it one is a convention this ticket declined to set on
 * its way past.
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

import * as React from "react";
import { requestSkill } from "@/app/(site)/publish/actions";
import { skillRequestFields } from "./schema";
import { noticeFor, type SkillRequestNotice } from "./skill-request-notice";

export type SkillRequestResult = Awaited<ReturnType<typeof requestSkill>>;

const INITIAL: SkillRequestResult = {};

export interface SkillRequestMachine {
  /** Whether the request is in flight, so the button can say so. */
  readonly pending: boolean;
  /** What to announce, or nothing yet. */
  readonly notice: SkillRequestNotice | undefined;
  /** What is in the field. Owned here, because landing is what empties it. */
  readonly text: string;
  readonly setText: (text: string) => void;
  /** Send what she typed. Validated here first, so an empty field costs no round trip. */
  readonly send: () => void;
  /** The client-side verdict on the field, when there is one. */
  readonly fieldError: string | undefined;
}

export function useSkillRequest(): SkillRequestMachine {
  const [result, dispatch, pending] = React.useActionState(requestSkill, INITIAL);
  const [fieldError, setFieldError] = React.useState<string | undefined>(undefined);
  const [text, setText] = React.useState("");

  /**
   * **Emptied when a request lands — adjusted during render, keyed on the result
   * that has not been seen yet.**
   *
   * Two shapes were wrong before this one, and both are worth naming because both
   * read as obviously correct. Deriving the value as `sent ? "" : text` empties
   * the field on success and then keeps emptying it: `sent` stays true for as
   * long as the last result does, so the controlled input was **pinned** empty and
   * a second request could not be typed at all — found at seam 3, on the second
   * request, because the tests sent one. Doing it in an effect fixes the
   * behaviour and asks React for a second render to do what the first could have
   * done, which is what `react(set-state-in-effect)` says out loud.
   *
   * So the reset is React's documented adjustment during render: remember which
   * result has been acted on, and when a new one arrives, act on it once.
   * `result` is a fresh object per dispatch, so this fires for every outcome —
   * including two successes in a row, which is the case that started this.
   */
  const [actedOn, setActedOn] = React.useState(result);

  if (actedOn !== result) {
    setActedOn(result);
    if (result.data?.requested) setText("");
  }

  function send() {
    const parsed = skillRequestFields.safeParse({ text });

    if (!parsed.success) {
      // The same sentence the server would answer with, without the trip.
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);

    const formData = new FormData();
    formData.set("text", parsed.data.text);
    React.startTransition(() => dispatch(formData));
  }

  return { pending, notice: noticeFor(result), text, setText, send, fieldError };
}
