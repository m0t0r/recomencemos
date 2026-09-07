/**
 * The seventh state (C39): he has opened more profiles than NFR26's ceiling
 * allows, and this is what he reads instead of one.
 *
 * **The sentence is the ceiling's own.** `CEILING_REFUSALS` in
 * `@repo/domain/rate-limit` holds it, because a refusal has to quote a count and
 * a wait that this component does not know and must not guess. What is here is
 * the heading over it and the door that is still open.
 *
 * **This is a returned response, not a thrown one** (NFR26's second half, C51).
 * The page renders this component; nothing raises an `AppError`, so an
 * enumeration sweep that trips the ceiling costs one `warn` line per request and
 * no Sentry event at all.
 *
 * **It is deliberately not a 404 and not a 403.** He is a signed-in Account who
 * has done nothing wrong yet, and a page that pretended the profile had vanished
 * would be a lie he could catch by waiting an hour. It is also not styled as an
 * error: reading resumes on its own.
 */

import { Alert, AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import { RATE_LIMITED_HEADING } from "../_lib/messages";
import { BackToList } from "./back-to-list";

export function ReadPaused({ explanation }: { readonly explanation: string }) {
  return (
    <div className="flex flex-col gap-6">
      {/*
        `role="status"` rather than `alert`: nothing is wrong and nothing is
        urgent, and an assertive announcement would interrupt whatever he was
        reading to tell him about a rate.
      */}
      <Alert
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- `<output>` takes phrasing content only; this holds a title and a paragraph
        role="status"
      >
        <AlertTitle>{RATE_LIMITED_HEADING}</AlertTitle>
        <AlertDescription>
          <p className="text-pretty">{explanation}</p>
        </AlertDescription>
      </Alert>

      {/*
        The door the refusal's last sentence names, made reachable. The two
        public lists carry no ceiling at all, so this link works while this
        panel is on screen.
      */}
      <BackToList />
    </div>
  );
}
