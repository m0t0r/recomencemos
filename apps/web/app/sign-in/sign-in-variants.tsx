"use client";

/**
 * PROTOTYPE — throwaway. Delete this file and `prototype-switcher.tsx` when a
 * variant is locked (#12).
 *
 * Three variants of `/sign-in`, switchable via `?variant=`, on the real route
 * with the real Server Action behind them. Variant A is `sign-in-form.tsx` and
 * is the production shape; B and C live here.
 *
 * The door order is **not** what is being asked. That was settled at
 * `/impeccable shape` — Google leads, the email door is fully present below it,
 * the shared-device checkbox governs both. What is open is the structure the
 * three of them sit in, and these disagree about it rather than about colour.
 */

import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Checkbox } from "@repo/design-system/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Label } from "@repo/design-system/components/label";
import { useId } from "react";
import {
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LABEL,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_HELP,
  SHARED_DEVICE_LABEL,
  SIGN_IN_TITLE,
} from "./messages";
import { FeedbackRegion, type SignInFormProps } from "./sign-in-form";
import { useSignIn } from "./use-sign-in";

/**
 * **Variant B — "Framed card".** The conventional sign-in box: one bordered card
 * on a tinted page, heading inside it, everything contained.
 *
 * The thesis is that a boundary helps. On a desktop viewport an open column
 * floats in a lot of white; a card says "this is the thing to deal with" and
 * gives the eye an edge. It is also the shape every other sign-in page a Hirer
 * has ever used has, which is worth something on a surface where familiarity
 * beats expression.
 *
 * What it costs: on the phone this product is designed for, the card border is a
 * line drawn just inside the viewport edge — decoration that eats horizontal
 * space on the device that has least of it.
 */
export function VariantB({ googleAvailable, returnPath, error }: SignInFormProps) {
  const machine = useSignIn({ returnPath, error });
  const emailId = useId();
  const sharedDeviceId = useId();
  const helpId = useId();

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Card className="flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {SIGN_IN_TITLE}
        </h1>

        <FeedbackRegion machine={machine} />

        {googleAvailable ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-12 w-full text-base"
              onClick={machine.signInWithGoogle}
              disabled={machine.googlePending}
              aria-busy={machine.googlePending}
            >
              {GOOGLE_BUTTON}
            </Button>
            <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
          </div>
        ) : null}

        {googleAvailable ? (
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-sm">o</span>
            <span className="bg-border h-px flex-1" />
          </div>
        ) : null}

        <form action={machine.formAction} className="flex flex-col gap-4">
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="sharedDevice" value={machine.sharedDevice ? "on" : "off"} />

          <Field>
            <FieldLabel htmlFor={emailId}>{EMAIL_LABEL}</FieldLabel>
            <FieldDescription>{EMAIL_DOOR_PRECONDITION}</FieldDescription>
            <Input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={machine.state.status === "field_error"}
              className="h-12 text-base"
            />
          </Field>

          <Button
            type="submit"
            variant={googleAvailable ? "secondary" : "default"}
            className="h-12 w-full text-base"
            disabled={machine.emailPending}
            aria-busy={machine.emailPending}
          >
            {machine.awaitingLink ? RESEND_LINK_BUTTON : SEND_LINK_BUTTON}
          </Button>
        </form>

        <div className="border-border flex items-start gap-3 border-t pt-5">
          <Checkbox
            id={sharedDeviceId}
            checked={machine.sharedDevice}
            onCheckedChange={(checked) => machine.setSharedDevice(checked === true)}
            aria-describedby={helpId}
            className="mt-1"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={sharedDeviceId} className="text-base font-normal">
              {SHARED_DEVICE_LABEL}
            </Label>
            <p id={helpId} className="text-muted-foreground text-sm leading-5">
              {SHARED_DEVICE_HELP}
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}

/**
 * **Variant C — "Two doors, named".** Each door is its own labelled block with
 * its own surface, and the shared-device choice is a footer bar pinned below
 * both.
 *
 * The thesis is that "there are two ways in and they are different" is the most
 * useful thing this page can communicate, so it is communicated structurally
 * instead of by a hairline `o`. Each block carries a small heading naming what
 * that door costs her — nothing, or a mailbox she can open — which is the
 * comparison she is actually making. The footer bar makes the checkbox's reach
 * over *both* doors unambiguous, which is the thing the shape session flagged as
 * easy to get wrong.
 *
 * What it costs: more chrome and more words on a page whose job is to get out of
 * the way, and two headings competing with the `<h1>`.
 */
export function VariantC({ googleAvailable, returnPath, error }: SignInFormProps) {
  const machine = useSignIn({ returnPath, error });
  const emailId = useId();
  const sharedDeviceId = useId();
  const helpId = useId();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
        {SIGN_IN_TITLE}
      </h1>

      <FeedbackRegion machine={machine} />

      {googleAvailable ? (
        <section className="bg-secondary flex flex-col gap-3 rounded-xl p-5">
          <h2 className="text-foreground text-base font-semibold">Con Google, en un toque</h2>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={machine.signInWithGoogle}
            disabled={machine.googlePending}
            aria-busy={machine.googlePending}
          >
            {GOOGLE_BUTTON}
          </Button>
          <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
        </section>
      ) : null}

      <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-foreground text-base font-semibold">Con un enlace a tu correo</h2>
        <p className="text-muted-foreground text-sm leading-5">{EMAIL_DOOR_PRECONDITION}</p>

        <form action={machine.formAction} className="flex flex-col gap-3">
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="sharedDevice" value={machine.sharedDevice ? "on" : "off"} />

          <Field>
            <FieldLabel htmlFor={emailId}>{EMAIL_LABEL}</FieldLabel>
            <Input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={machine.state.status === "field_error"}
              className="h-12 text-base"
            />
          </Field>

          <Button
            type="submit"
            variant="secondary"
            className="h-12 w-full text-base"
            disabled={machine.emailPending}
            aria-busy={machine.emailPending}
          >
            {machine.awaitingLink ? RESEND_LINK_BUTTON : SEND_LINK_BUTTON}
          </Button>
        </form>
      </section>

      <div className="bg-muted flex items-start gap-3 rounded-xl p-4">
        <Checkbox
          id={sharedDeviceId}
          checked={machine.sharedDevice}
          onCheckedChange={(checked) => machine.setSharedDevice(checked === true)}
          aria-describedby={helpId}
          className="mt-1"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={sharedDeviceId} className="text-base font-normal">
            {SHARED_DEVICE_LABEL}
          </Label>
          <p id={helpId} className="text-muted-foreground text-sm leading-5">
            {SHARED_DEVICE_HELP}
          </p>
        </div>
      </div>
    </main>
  );
}
