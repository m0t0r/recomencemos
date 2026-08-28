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
 *    _Este aparato_ the row's heading and demoted the device to the meta line,
 *    so the one row that is **not** a candidate for closing was the row that
 *    broke the column. It is a `Badge` beside the name now, so the three names
 *    line up.
 * 2. **A state-led ordering was tried and failed on ordinary data.** Leading
 *    with _"Abierta hace 6 días"_ reads well until every session was opened the
 *    same day, which is the common case — then all three rows lead
 *    _"Abierta hoy"_ and the primary line carries nothing.
 *
 * **_Este aparato_ stays a word.** NFR20 and the voice guide both refuse meaning
 * carried by anything a screen-reader user or a person who cannot distinguish
 * the accent would miss, so the marker is read aloud in the row's own flow — it
 * is never the tint, never the border, never "the first one".
 *
 * A Server Component: no state, no handlers, no effects, so it costs the client
 * bundle nothing.
 */

import { Badge } from "@repo/design-system/components/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@repo/design-system/components/item";
import { THIS_DEVICE } from "../_lib/messages";
import type { SessionView } from "../_lib/view";

export interface SessionListProps {
  readonly sessions: readonly SessionView[];
}

export function SessionList({ sessions }: SessionListProps) {
  /*
    **A real `<ul>`, not `ItemGroup`.** The registry's group is a `div` carrying
    `role="list"`, which would then need `role="listitem"` on every row — and
    `jsx-a11y/prefer-tag-over-role` is right that the element is better than the
    role. Base UI's `render` prop makes each `Item` an actual `<li>`, so the list
    is a list to every reader without a single ARIA attribute. `Item` and its
    parts still carry all the styling; only the container changed.
  */
  return (
    <ul className="flex list-none flex-col p-0">
      {sessions.map((session, index) => (
        <li key={session.id}>
          {index > 0 ? <ItemSeparator className="my-0" /> : null}
          <Item render={<div />} size="sm" className="px-0">
            <ItemContent>
              <ItemTitle>
                {session.device}
                {session.current ? (
                  <Badge variant="secondary" className="font-normal">
                    {THIS_DEVICE}
                  </Badge>
                ) : null}
              </ItemTitle>
              {/*
                `line-clamp-none` overrides the registry's two-line clamp, and
                the brief is explicit about why: a truncated device string is
                worse than a wrapped one, because she is placing a machine from a
                short label and `Chrome en Wind…` places nothing.
              */}
              <ItemDescription className="line-clamp-none text-pretty">
                {session.started} · {session.expires}
              </ItemDescription>
            </ItemContent>
          </Item>
        </li>
      ))}
    </ul>
  );
}
