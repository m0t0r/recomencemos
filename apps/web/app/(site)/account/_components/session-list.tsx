/**
 * The list of open sessions — **evidence, not a control.**
 *
 * Nothing here is focusable. The rows are what make the one button below them an
 * informed tap, and a list of things that cannot be acted on individually is
 * deliberate: per-row close was considered at shape and declined, because it is
 * a second domain method and a second row in the authorization table for a
 * gesture the ticket's contract does not name.
 *
 * **Variant A′, locked after `/prototype` UI** — the three that lost live on
 * `prototype/13-account-variants`, and the shaping is
 * `.impeccable/briefs/account.md`. Two findings decided it, and neither was
 * visible before the variants were rendered against real rows:
 *
 * 1. **The device name leads every row, including this one.** The task on this
 *    surface is *recognition* — she is hunting a machine she does not recognise
 *    — which makes the device name the scan column. The first draft made
 *    the current-device marker the row's heading and demoted the device to the
 *    meta line,
 *    so the one row that is **not** a candidate for closing was the row that
 *    broke the column. The marker sits beside the name now, so the three names
 *    line up.
 * 2. **A state-led ordering was tried and failed on ordinary data.** Leading
 *    with _"Abierta hace 6 días"_ reads well until every session was opened the
 *    same day, which is the common case — then all three rows lead
 *    _"Abierta hoy"_ and the primary line carries nothing.
 *
 * **The marker stays a word, and names no device.** NFR20 and the voice guide
 * both refuse meaning carried by anything a screen-reader user or a person who
 * cannot distinguish the accent would miss, so it is read aloud in the row's own
 * flow — never the tint, never the border, never "the first one". It says
 * _Estás aquí_ rather than naming a device because a session is a browser, not a
 * machine: two browsers on one laptop are two rows, and a device noun would tell
 * her the other one is somewhere else. See `CURRENT_SESSION_MARKER` in `_lib/messages.ts`.
 *
 * **The word is no longer inside a chip.** It was a `Badge`, which is a filled
 * wash of the ink — and the world names this exact case when it says *state is a
 * mark, never a hue: a current session is a word*. A chip is the hue drawn
 * around the mark, so the mark now carries the row on its own. The string, its
 * position beside the name and its place in the reading order are unchanged;
 * what went is the fill.
 *
 * **Rows on rulings, not registry `Item`s.** The list is drawn the way every
 * other list in this product is drawn — the ruling between rows, the rose margin
 * line beside them, both from the `ruled-page` its parent carries. `Item`,
 * `ItemContent` and `ItemSeparator` drew a container this product's lists do not
 * have; `profile-row.tsx` is the prior art, down to the rule belonging to the
 * row *above* which it is drawn.
 *
 * A Server Component: no state, no handlers, no effects, so it costs the client
 * bundle nothing.
 */

import { Separator } from "@repo/design-system/components/separator";
import { CURRENT_SESSION_MARKER } from "../_lib/messages";
import type { SessionView } from "../_lib/view";

export interface SessionListProps {
  readonly sessions: readonly SessionView[];
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    /*
      The `role` is not redundant where it matters. Safari drops a `ul`'s
      implicit list role when `list-style: none` is applied, which Tailwind's
      preflight applies to every list — so on the one browser a Worker on an
      iPhone is using, restating it is the difference between "list, 3 items"
      and no list semantics at all. `profile-list.tsx` carries the same pair for
      the same reason.
    */
    <ul
      className="flex flex-col"
      // oxlint-disable-next-line no-redundant-roles -- see above.
      role="list"
    >
      {sessions.map((session, index) => (
        <li key={session.id}>
          {/* The rule belongs *above* this row, so the list never opens on one. */}
          {index > 0 ? <Separator /> : null}
          <div className="flex flex-col gap-0.5 py-4">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-foreground font-medium">{session.device}</span>
              {session.current ? (
                <span className="text-muted-foreground text-sm">{CURRENT_SESSION_MARKER}</span>
              ) : null}
            </p>
            {/*
              Wrapped rather than clamped, and the brief is explicit about why: a
              truncated device string is worse than a wrapped one, because she is
              placing a machine from a short label and `Chrome en Wind…` places
              nothing.
            */}
            <p className="text-muted-foreground text-sm text-pretty">
              {session.started} · {session.expires}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
