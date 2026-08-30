/**
 * What the setup link opens: the QR with its manual-entry secret, and the ten
 * backup codes beside it.
 *
 * **Two acts, and neither of them is on this screen**: get the QR into a phone
 * camera, and get ten codes somewhere they will survive. The page's whole purpose
 * is to make both easy and then get out of the way — there is nothing to fill in,
 * because the six digits that prove the authenticator works are typed back into
 * the terminal that printed the link.
 *
 * **The stakes are asymmetric.** A person who fails to scan the QR just runs the
 * command again. The codes are the thing with no second chance, and they are the
 * only way back in when the phone is gone.
 *
 * **So the two acts sit side by side rather than one under the other, and that
 * came out of the prototype rather than out of the brief.** The brief's shape
 * was sequential — QR, then codes — and it named the risk that shape carries:
 * scan, switch to the terminal, never scroll, lose the codes. Run against the
 * real route, the sequential variant put the codes below the fold on an ordinary
 * laptop, which is exactly that risk arriving. Two columns removes it rather than
 * ordering around it: on the desktop this screen was confirmed to be read on,
 * neither act is below the other and there is nothing to scroll past.
 *
 * **Both halves are bounded regions, which is the part the brief was right
 * about.** The first two-column draft boxed the QR and left the codes loose, and
 * the codes then read as an aside beside the thing with a border around it — the
 * subordinate treatment the brief refuses, reintroduced by the layout instead of
 * by the order. Each half is a card, so neither is the other's margin.
 *
 * On a narrow screen the columns stack, which puts the page back in the brief's
 * order — QR, then codes — with the shown-once sentence still above the codes
 * rather than below them.
 */

import { Card, CardContent } from "@repo/design-system/components/card";
import { Textarea } from "@repo/design-system/components/textarea";
import { QrCode } from "@/app/_components/qr-code";
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
import { CopyCodes } from "./copy-codes";

/**
 * Literals rather than `useId`, because that hook belongs to a Client Component
 * and this page renders exactly once per request with one of each region on it.
 */
const MANUAL_SECRET_HEADING_ID = "manual-entry-secret";
const BACKUP_CODES_HEADING_ID = "backup-codes";

export interface EnrolmentProps {
  /** Server-minted, always. Never built from anything a person typed. */
  readonly totpUri: string;
  readonly manualSecret: string;
  readonly backupCodes: readonly string[];
}

export function Enrolment({ totpUri, manualSecret, backupCodes }: EnrolmentProps) {
  return (
    /*
      Centred, and wider than the door's measure — two columns of which one holds
      ten grouped codes need the room. No chrome: this route sits outside the
      queue's group precisely so it renders none, and there is no session yet to
      describe.
    */
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-foreground text-2xl font-semibold">{ENROL_TITLE}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          {/*
            `CardContent` rather than `Card` carrying its own padding class: the
            registry already exports the padded column, and reproducing it by
            overriding is exactly the hand-rolled equivalent the review pass
            exists to catch.
          */}
          <CardContent className="gap-4">
            <p className="text-foreground text-sm leading-5 text-pretty">{QR_INSTRUCTION}</p>

            <QrCode value={totpUri} label={QR_ALT} />

            {/*
              **A named region rather than a loose string.** The secret is the
              alternative to the QR, and a control on its own announces only its
              own characters. The heading names the region and `aria-labelledby`
              ties the two together, so the secret is reached with that context
              already given.
            */}
            <section aria-labelledby={MANUAL_SECRET_HEADING_ID} className="flex flex-col gap-1">
              <h2 id={MANUAL_SECRET_HEADING_ID} className="text-foreground text-sm font-semibold">
                {MANUAL_SECRET_HEADING}
              </h2>
              <p className="text-muted-foreground text-sm leading-5 text-pretty">
                {MANUAL_SECRET_EXPLANATION}
              </p>
              {/*
                **A read-only field, which is a departure from the brief's
                wording and an answer to what it was after.**

                The brief asks for the secret to be *selectable and focusable*,
                and the first draft did that with `tabIndex={0}` on a paragraph.
                That is worse than it looks: a tab stop on static text neither
                activates anything nor places a caret, because selecting
                non-editable text from the keyboard needs caret browsing — a
                browser mode no attribute here can turn on. So the paragraph was
                selectable **by pointer only**, which leaves a keyboard or
                screen-reader user with no way to take the one value that exists
                for the person whose camera failed.

                A `readOnly` control is the ordinary answer: it is focusable
                because it is a real control, `⌘A`/`Ctrl+A` selects its whole
                value, a screen reader announces it as a textbox named by the
                heading above, and it submits nothing because there is no form on
                this page. It is not a field to fill in and it does not pretend
                to be one.

                **And it is a `Textarea` rather than an `Input`, which the
                screenshot decided.** The base32 secret is 52 characters; a
                single-line field scrolls, so it showed about forty of them and
                silently truncated the rest — on the one control that exists for
                the person who has to type it into an authenticator by hand. Two
                wrapped rows show all of it. `field-sizing-content` in the
                registry component grows it if a future secret is longer.
              */}
              <Textarea
                readOnly
                rows={2}
                value={manualSecret}
                aria-labelledby={MANUAL_SECRET_HEADING_ID}
                className="bg-muted min-h-0 resize-none font-mono text-sm break-all"
              />
            </section>

            <p className="text-muted-foreground text-sm leading-5 text-pretty">
              {TERMINAL_INSTRUCTION}
            </p>
          </CardContent>
        </Card>

        <Card>
          {/*
            The `<section>` is inside the card rather than the card being one:
            the registry's `Card` renders a `<div>` and takes no `render` prop,
            and `aria-labelledby` on a roleless `<div>` names nothing. Nested,
            the landmark is real and the card stays what it is — a border.
          */}
          <CardContent>
            <section aria-labelledby={BACKUP_CODES_HEADING_ID} className="flex flex-col gap-3">
              <h2 id={BACKUP_CODES_HEADING_ID} className="text-foreground text-lg font-semibold">
                {BACKUP_CODES_HEADING}
              </h2>

              {/* Directness 5: the absence first, and above the codes rather than below. */}
              <p className="text-foreground text-sm leading-5 font-medium text-pretty">
                {BACKUP_CODES_SHOWN_ONCE}
              </p>
              <p className="text-muted-foreground text-sm leading-5 text-pretty">
                {BACKUP_CODES_PURPOSE}
              </p>

              {/*
              **A list, not a paragraph and not a `<pre>`.** Ten discrete items
              is what they are, "list, 10 items" is what a screen reader should
              announce, and it is what lets one be selected without dragging
              through its neighbours.

              The mono face and the size are load-bearing rather than styling:
              this is the surface where somebody transcribes character by
              character, on the worst day they have had.
            */}
              <ul className="text-foreground grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
                {backupCodes.map((code) => (
                  <li key={code} className="select-all">
                    {code}
                  </li>
                ))}
              </ul>

              <CopyCodes codes={backupCodes} />

              <p className="text-muted-foreground text-sm leading-5 text-pretty">
                {BACKUP_CODES_STORAGE}
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
