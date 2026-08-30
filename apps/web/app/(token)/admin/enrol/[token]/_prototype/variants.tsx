/**
 * PROTOTYPE — throwaway. Three variants of the enrolment screen, on the real
 * route with real data, switchable via `?variant=`.
 *
 * **The question:** the two acts are *get the QR into a phone camera* and *get
 * ten codes somewhere they will survive*. The QR is recoverable — run the
 * command again — and the codes are not. So how should the codes and the
 * "shown once" sentence sit against the QR, given the named risk: scan, switch
 * to the terminal, never scroll, lose the codes.
 *
 * `A` is the shipped shape and is `Enrolment` itself, so it is not duplicated
 * here. `B` and `C` are the disagreements.
 */

import { Card } from "@repo/design-system/components/card";
import { Separator } from "@repo/design-system/components/separator";
import { QrCode } from "@/app/_components/qr-code";
import { CopyCodes } from "../_components/copy-codes";
import type { EnrolmentProps } from "../_components/enrolment";
import {
  BACKUP_CODES_HEADING,
  BACKUP_CODES_PURPOSE,
  BACKUP_CODES_SHOWN_ONCE,
  BACKUP_CODES_STORAGE,
  ENROL_TITLE,
  MANUAL_SECRET_EXPLANATION,
  MANUAL_SECRET_HEADING,
  QR_ALT,
  QR_INSTRUCTION,
  TERMINAL_INSTRUCTION,
} from "../_lib/messages";

function Codes({ backupCodes }: { readonly backupCodes: readonly string[] }) {
  return (
    <ul className="text-foreground grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
      {backupCodes.map((code) => (
        <li key={code} className="select-all">
          {code}
        </li>
      ))}
    </ul>
  );
}

/**
 * **B — codes first.** The half with no second chance leads, and the shown-once
 * sentence is the page's opening line, under the `<h1>` and above everything.
 * The QR follows in a quieter block. Tests whether the scan-then-never-scroll
 * risk is better answered by putting the losable half where nobody can miss it,
 * at the cost of opening on the recovery path rather than on the task.
 */
export function VariantB({ totpUri, manualSecret, backupCodes }: EnrolmentProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <h1 className="text-foreground text-2xl font-semibold">{ENROL_TITLE}</h1>

      <p className="text-foreground text-sm leading-5 font-medium text-pretty">
        {BACKUP_CODES_SHOWN_ONCE}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground text-lg font-semibold">{BACKUP_CODES_HEADING}</h2>
        <p className="text-muted-foreground text-sm leading-5 text-pretty">
          {BACKUP_CODES_PURPOSE}
        </p>
        <Codes backupCodes={backupCodes} />
        <CopyCodes codes={backupCodes} />
        <p className="text-muted-foreground text-sm leading-5 text-pretty">
          {BACKUP_CODES_STORAGE}
        </p>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <p className="text-foreground text-sm leading-5 text-pretty">{QR_INSTRUCTION}</p>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <QrCode value={totpUri} label={QR_ALT} />
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-sm font-semibold">{MANUAL_SECRET_HEADING}</h2>
            <p className="text-muted-foreground text-sm leading-5">{MANUAL_SECRET_EXPLANATION}</p>
            <p className="text-foreground bg-muted rounded-md px-2 py-1 font-mono text-sm break-all select-all">
              {manualSecret}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-5">{TERMINAL_INSTRUCTION}</p>
      </section>
    </main>
  );
}

/**
 * **C — two columns, neither act below the other.** QR left, codes right, on the
 * desktop this screen was confirmed to be read on. Nothing is below the fold, so
 * the scroll risk disappears entirely — at the cost of two things competing for
 * attention at once, and of a layout that stacks back into A's order on a narrow
 * screen anyway.
 */
export function VariantC({ totpUri, manualSecret, backupCodes }: EnrolmentProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-foreground text-2xl font-semibold">{ENROL_TITLE}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="gap-4 px-(--card-spacing)">
          <p className="text-foreground text-sm leading-5 text-pretty">{QR_INSTRUCTION}</p>
          <QrCode value={totpUri} label={QR_ALT} />
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-sm font-semibold">{MANUAL_SECRET_HEADING}</h2>
            <p className="text-muted-foreground text-sm leading-5">{MANUAL_SECRET_EXPLANATION}</p>
            <p className="text-foreground bg-muted rounded-md px-2 py-1 font-mono text-sm break-all select-all">
              {manualSecret}
            </p>
          </div>
          <p className="text-muted-foreground text-sm leading-5">{TERMINAL_INSTRUCTION}</p>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-lg font-semibold">{BACKUP_CODES_HEADING}</h2>
          <p className="text-foreground text-sm leading-5 font-medium text-pretty">
            {BACKUP_CODES_SHOWN_ONCE}
          </p>
          <p className="text-muted-foreground text-sm leading-5 text-pretty">
            {BACKUP_CODES_PURPOSE}
          </p>
          <Codes backupCodes={backupCodes} />
          <CopyCodes codes={backupCodes} />
          <p className="text-muted-foreground text-sm leading-5 text-pretty">
            {BACKUP_CODES_STORAGE}
          </p>
        </section>
      </div>
    </main>
  );
}
