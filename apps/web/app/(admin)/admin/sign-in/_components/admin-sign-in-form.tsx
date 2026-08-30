"use client";

/**
 * The Admin's door: password, then a code — with enrolment in between the first
 * time, because runbook §6 grants the Account before any second factor exists.
 *
 * **Three steps in one Client Component, and the step is derived rather than
 * stored.** Which panel renders is read off what the actions have returned, so
 * there is no step counter to fall out of agreement with the server's actual
 * state. The server's state is Better Auth's cookies — the 2FA challenge cookie,
 * or a `password` session — and those are what the next action is authorized
 * against, so a step this component got wrong would be refused rather than
 * honoured.
 *
 * **The stages are not equally reachable and that asymmetry is NFR14.** A correct
 * password never lands on `/admin`; it lands here, one field short. The only path
 * that reaches the queue is `verifyAdminCode`'s redirect.
 *
 * **NFR4 does not bind this story** (it binds 2 and 4), so this surface may
 * require JavaScript, and `InputOTP` does. The password step still posts natively
 * — it is a plain `<form action>` — which is what keeps the shape the same as
 * `/sign-in`'s rather than introducing a second idiom for one screen.
 */

import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/design-system/components/input-otp";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  BACKUP_CODE_DISCLOSURE,
  BACKUP_CODE_EXPLANATION,
  BACKUP_CODE_LABEL,
  BACKUP_CODES_EXPLANATION,
  BACKUP_CODES_HEADING,
  CODE_EXPLANATION,
  CODE_HEADING,
  CODE_LABEL,
  CONTINUE,
  CONTINUING,
  ADMIN_SIGN_IN_TITLE,
  EMAIL_LABEL,
  ENROL_EXPLANATION,
  ENROL_HEADING,
  PASSWORD_LABEL,
  QR_ALT,
  VERIFY,
  VERIFYING,
} from "../_lib/messages";
import { enrolAdminCode, signInAdmin, verifyAdminCode } from "../actions";
import { TOTP_DIGITS } from "../_lib/schema";
import { QrCode } from "@/app/_components/qr-code";

type SignInResult = Awaited<ReturnType<typeof signInAdmin>>;
type EnrolResult = Awaited<ReturnType<typeof enrolAdminCode>>;
type VerifyResult = Awaited<ReturnType<typeof verifyAdminCode>>;

/** next-safe-action's own "nothing has happened yet", so this surface invents no idle state. */
const INITIAL = {};

export function AdminSignInForm() {
  const [signInResult, signInAction, signingIn] = useActionState<SignInResult, FormData>(
    signInAdmin,
    INITIAL,
  );
  const [enrolResult, enrolAction, enrolling] = useActionState<EnrolResult, FormData>(
    enrolAdminCode,
    INITIAL,
  );
  const [verifyResult, verifyAction, verifying] = useActionState<VerifyResult, FormData>(
    verifyAdminCode.bind(null, "totp"),
    INITIAL,
  );

  const announcementRef = useRef<HTMLDivElement>(null);

  /**
   * Focus moves to what happened, not to where to fix it — the same rule
   * `/sign-in` follows. A screen-reader user dropped straight back into the code
   * field hears the field and has to go looking for the reason it is still there.
   *
   * Read from the results inside the effect rather than from a derived boolean: a
   * boolean stays `true` across a second failure, so focus would move on the first
   * outcome and never again.
   */
  useEffect(() => {
    if (signInResult.serverError ?? enrolResult.serverError ?? verifyResult.serverError) {
      announcementRef.current?.focus();
    }
  }, [signInResult, enrolResult, verifyResult]);

  const stage = signInResult.data?.stage;
  const enrolled = enrolResult.data;

  const problem =
    verifyResult.serverError?.message ??
    enrolResult.serverError?.message ??
    signInResult.serverError?.message;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Card className="flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {ADMIN_SIGN_IN_TITLE}
        </h1>

        <ProblemRegion announcementRef={announcementRef} message={problem} />

        {stage === undefined ? <PasswordStep action={signInAction} pending={signingIn} /> : null}

        {/*
          Enrolment, then the code — in that order and on the same screen, because
          the code being asked for is the one the app just started generating. A
          person who has scanned the QR is already looking at six digits.
        */}
        {stage === "enrolment" && !enrolled ? (
          <EnrolStep action={enrolAction} pending={enrolling} />
        ) : null}

        {enrolled ? (
          <EnrolmentSecrets totpUri={enrolled.totpUri} backupCodes={enrolled.backupCodes} />
        ) : null}

        {stage === "two_factor" || enrolled ? (
          <>
            <CodeStep action={verifyAction} pending={verifying} />
            {/*
              **Only on the sign-in path, never after enrolment.** The codes were
              handed over ten seconds ago and the authenticator app is already
              generating digits; offering the recovery door there would invite
              spending one of ten single-use codes to finish a setup the phone in
              your hand can complete.
            */}
            {stage === "two_factor" ? <BackupCodeStep /> : null}
          </>
        ) : null}
      </Card>
    </main>
  );
}

function PasswordStep({
  action,
  pending,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const emailId = useId();
  const passwordId = useId();

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={emailId}>{EMAIL_LABEL}</FieldLabel>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={passwordId}>{PASSWORD_LABEL}</FieldLabel>
        {/*
          `current-password` rather than `new-password`: sign-up is closed
          (`emailAndPassword.disableSignUp`), so a password manager offering to
          generate one here would be offering to lock the Admin out.
        */}
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? CONTINUING : CONTINUE}
      </Button>
    </form>
  );
}

/**
 * The password is asked for a second time, and that is Better Auth's requirement
 * rather than this surface's caution: `/two-factor/enable` re-validates it,
 * because adding a second factor is a credential-changing act and a borrowed
 * session should not be able to perform one.
 */
function EnrolStep({
  action,
  pending,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const passwordId = useId();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">{ENROL_HEADING}</h2>
        <p className="text-muted-foreground text-sm leading-5 text-pretty">{ENROL_EXPLANATION}</p>
      </div>

      <Field>
        <FieldLabel htmlFor={passwordId}>{PASSWORD_LABEL}</FieldLabel>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? CONTINUING : CONTINUE}
      </Button>
    </form>
  );
}

/**
 * The QR and the ten backup codes — **the only time either is readable**.
 *
 * Better Auth encrypts both at rest with `BETTER_AUTH_SECRET` and nothing in this
 * repository decrypts them, so closing this screen without writing the codes down
 * loses them for good. That is why the instruction sits here in full rather than
 * as a link to runbook §6, and why the codes are rendered as text a person can
 * select and print rather than behind a "copy" affordance a printer cannot use.
 */
function EnrolmentSecrets({
  totpUri,
  backupCodes,
}: {
  totpUri: string;
  backupCodes: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <QrCode value={totpUri} label={QR_ALT} />

      <div className="flex flex-col gap-2">
        <h2 className="text-foreground text-lg font-semibold">{BACKUP_CODES_HEADING}</h2>
        <p className="text-muted-foreground text-sm leading-5 text-pretty">
          {BACKUP_CODES_EXPLANATION}
        </p>
        {/*
          A list, not a paragraph: ten codes are ten items, and a screen reader
          announcing "list, 10 items" is the difference between a person knowing
          they have them all and counting by ear.
        */}
        <ul className="text-foreground grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
          {backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CodeStep({ action, pending }: { action: (formData: FormData) => void; pending: boolean }) {
  const codeId = useId();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">{CODE_HEADING}</h2>
        <p className="text-muted-foreground text-sm leading-5 text-pretty">{CODE_EXPLANATION}</p>
      </div>

      <Field>
        <FieldLabel htmlFor={codeId}>{CODE_LABEL}</FieldLabel>
        {/*
          `@shadcn/input-otp`, from the registry — `REVIEW.md`'s registry-equivalents
          pass, and the reason this is not six hand-rolled boxes. `autoComplete`
          is what lets a phone offer the code from a notification.
        */}
        <InputOTP id={codeId} name="code" maxLength={TOTP_DIGITS} autoComplete="one-time-code">
          <InputOTPGroup>
            {Array.from({ length: TOTP_DIGITS }, (_, index) => (
              // The index *is* the identity here: these are positions in a fixed
              // six-slot control, not a list that can reorder.
              // oxlint-disable-next-line no-array-index-key
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </Field>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? VERIFYING : VERIFY}
      </Button>
    </form>
  );
}

/**
 * The backup-code door — **a second `<form>`, not a mode on the first**.
 *
 * DD5 makes ten printed codes a required recovery path (C43): losing the TOTP
 * device otherwise stops every Offer behind NFR7's 24-hour band and leaves every
 * reported Hirer frozen, because `unfreezeHirer` is an Admin action. So the person
 * reading this has lost their phone, and the worst thing to give them is a control
 * that first has to be persuaded to accept ten characters instead of six.
 *
 * **Two forms rather than one field with a toggle**, for the reason ADR-0015 gives
 * for bound arguments generally: the `kind` is a fact about *which door was used*,
 * and each form binds its own. A single form with a mode switch would need that
 * mode on the wire as state a caller could flip — and flipping it turns a
 * six-digit brute force into a backup-code brute force against a different
 * comparison.
 *
 * It is behind a `<details>` because it is the unusual path, and `<details>` is
 * the disclosure that works with no JavaScript and is keyboard-operable for free.
 */
function BackupCodeStep() {
  const [result, action, pending] = useActionState<VerifyResult, FormData>(
    verifyAdminCode.bind(null, "backup_code"),
    INITIAL,
  );
  const codeId = useId();
  const errorId = useId();
  const invalid = Boolean(result.serverError);

  return (
    <details className="border-border border-t pt-4">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm leading-5">
        {BACKUP_CODE_DISCLOSURE}
      </summary>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={codeId}>{BACKUP_CODE_LABEL}</FieldLabel>
          <FieldDescription>{BACKUP_CODE_EXPLANATION}</FieldDescription>
          <Input
            id={codeId}
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
          />
          {invalid ? <FieldError id={errorId}>{result.serverError?.message}</FieldError> : null}
        </Field>

        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? VERIFYING : VERIFY}
        </Button>
      </form>
    </details>
  );
}

/**
 * One region for every refusal on this screen, above the steps.
 *
 * **`Alert` from the registry**, and the shape is `(site)/account`'s rather than
 * a second one invented here — that panel already renders a refusal this way, and
 * `REVIEW.md`'s registry-equivalents pass is about exactly this.
 *
 * `role="status"` overrides the component's own `role="alert"`, for the reason
 * that panel records: `alert` is assertive and interrupts whatever a screen reader
 * is saying, and a wrong code on a door somebody uses daily is an ordinary outcome
 * rather than an unexpected one. `tabIndex={-1}` makes it a destination for focus
 * without putting it in the tab order.
 */
function ProblemRegion({
  announcementRef,
  message,
}: {
  announcementRef: React.RefObject<HTMLDivElement | null>;
  message: string | undefined;
}) {
  if (!message) return null;

  return (
    <Alert
      ref={announcementRef}
      variant="destructive"
      // The rule prefers `<output>` to this role, and it is right in general —
      // but the element is `Alert`, which is registry output rendering a `div`,
      // and files under `src/components/` are not hand-edited. Same scoping and
      // same reason as `(site)/account/_components/sessions-panel.tsx`.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Alert is registry output and renders a div.
      role="status"
      aria-live="polite"
      tabIndex={-1}
    >
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
