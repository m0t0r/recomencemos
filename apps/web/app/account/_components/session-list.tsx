/**
 * The list of open sessions — **evidence, not a control.**
 *
 * Nothing here is focusable. The rows are what makes the one button below them
 * an informed tap, and a list of things that cannot be acted on individually is
 * deliberate: per-row close was considered at shape and declined, because it is
 * a second domain method and a second row in the authorization table for a
 * gesture the ticket's contract does not name. See
 * `.impeccable/briefs/account.md`.
 *
 * **This is the component the `/prototype` UI session varies.** The row
 * treatment is the one genuinely open question the shape session left — bordered
 * rows, separated rows, or cards — so it is a component of its own rather than
 * JSX inside the panel, and the losing variants live on
 * `prototype/13-account-variants`.
 *
 * A Server Component: it holds no state, no handlers and no effects, so it costs
 * the client bundle nothing.
 */

import { Separator } from "@repo/design-system/components/separator";
import { THIS_DEVICE } from "../_lib/messages";
import type { SessionView } from "../_lib/view";

export interface SessionListProps {
  readonly sessions: readonly SessionView[];
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <ul className="flex list-none flex-col gap-0 p-0">
      {sessions.map((session, index) => (
        <li key={session.id}>
          {index > 0 ? <Separator /> : null}
          <SessionRow session={session} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One session.
 *
 * **_Este aparato_ is a word, never a colour or a position.** NFR20 and the
 * voice guide both refuse meaning carried by anything a screen reader or a
 * person who cannot distinguish the accent colour would miss — so the marker is
 * read aloud in the ordinary flow of the row rather than being a dot, a border,
 * or "the first one".
 *
 * **The second line wraps rather than truncating.** A truncated device string is
 * worse than a wrapped one: she is placing a machine from a short label, and
 * `Chrome en Wind…` places nothing.
 */
function SessionRow({ session }: { readonly session: SessionView }) {
  return (
    <div className="flex flex-col gap-0.5 py-3">
      <p className="text-foreground text-sm font-medium">
        {session.current ? THIS_DEVICE : session.device}
      </p>
      <p className="text-muted-foreground text-sm text-pretty">
        {session.current ? `${session.device} · ${session.started}` : session.started}
        {" · "}
        {session.expires}
      </p>
    </div>
  );
}
