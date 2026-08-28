/**
 * PROTOTYPE — three variants of the session list, switchable with `?variant=`.
 *
 * **Throwaway. This file does not merge.** It lands on
 * `prototype/13-account-variants` with the switcher, and the winner is rewritten
 * into `session-list.tsx` under production constraints. See
 * `.impeccable/briefs/account.md`.
 *
 * The question, in one line: **how are the rows treated, on a phone, when they
 * are evidence rather than controls?** The shape session settled everything else
 * — the list is shown, there is no per-row action, and the button carries the
 * count — and left this one open because it only settles by looking at it.
 *
 * The three disagree about **information hierarchy**, not about spacing:
 *
 * - **A — device-led, separated.** The browser name is the heading of each row
 *   and everything else is one muted line. Densest; reads as a list.
 * - **B — state-led, bordered.** Inverts it: how old the session is leads, and
 *   the device is secondary. The bet is that she triages by *recognition and
 *   recency* ("the one from six days ago"), not by browser name.
 * - **C — field-labelled cards.** Names the fields outright — _Aparato_,
 *   _Desde_, _Se cierra_ — for a person who has never seen this page. Most
 *   explicit, most vertical space.
 *
 * Every variant obeys the same four constraints, so the comparison is fair:
 * nothing is focusable, _Este aparato_ is a **word** rather than a colour or a
 * position, the secondary line wraps rather than truncating, and only registry
 * components and semantic tokens are used.
 */

import { Card } from "@repo/design-system/components/card";
import { Separator } from "@repo/design-system/components/separator";
import { THIS_DEVICE } from "../_lib/messages";
import type { SessionView } from "../_lib/view";

export const VARIANTS = ["A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_NAMES: Record<Variant, string> = {
  A: "Device-led, separated",
  B: "State-led, bordered",
  C: "Field-labelled cards",
};

interface Props {
  readonly sessions: readonly SessionView[];
}

/** A — the tracer bullet. Device name leads; one muted meta line under it. */
export function VariantA({ sessions }: Props) {
  return (
    <ul className="flex list-none flex-col gap-0 p-0">
      {sessions.map((session, index) => (
        <li key={session.id}>
          {index > 0 ? <Separator /> : null}
          <div className="flex flex-col gap-0.5 py-3">
            <p className="text-foreground text-sm font-medium">
              {session.current ? THIS_DEVICE : session.device}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              {session.current ? `${session.device} · ${session.started}` : session.started} ·{" "}
              {session.expires}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * B — state leads, device follows, each row its own bordered block.
 *
 * The current session's block is tinted with `bg-muted` **in addition to**
 * saying _Este aparato_, never instead of it — the word is what carries the
 * meaning and the tint is decoration that a screen reader is free to miss.
 */
export function VariantB({ sessions }: Props) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0">
      {sessions.map((session) => (
        <li
          key={session.id}
          className={`border-border rounded-lg border p-3 ${session.current ? "bg-muted" : "bg-card"}`}
        >
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-medium">
              {session.current ? THIS_DEVICE : `Abierta ${session.started}`}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              {session.device}
              {session.current ? ` · ${session.started}` : ""}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">{session.expires}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * C — each session a card, with the fields named.
 *
 * A `<dl>` rather than paragraphs, because that is what this is: three
 * label/value pairs per session. The label is read out by a screen reader, which
 * is the accessibility argument for this variant and the reason it is worth
 * comparing against two cheaper ones.
 */
export function VariantC({ sessions }: Props) {
  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {sessions.map((session) => (
        <li key={session.id}>
          <Card className="gap-0 p-4">
            {session.current ? (
              <p className="text-foreground mb-2 text-sm font-medium">{THIS_DEVICE}</p>
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground text-sm">Aparato</dt>
              <dd className="text-foreground text-sm text-pretty">{session.device}</dd>
              <dt className="text-muted-foreground text-sm">Desde</dt>
              <dd className="text-foreground text-sm">{session.started}</dd>
              <dt className="text-muted-foreground text-sm">Se cierra</dt>
              <dd className="text-foreground text-sm text-pretty">
                {session.expires.replace(/^se cierra /, "")}
              </dd>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function PrototypeSessionList({
  variant,
  sessions,
}: Props & { readonly variant: Variant }) {
  if (variant === "B") return <VariantB sessions={sessions} />;
  if (variant === "C") return <VariantC sessions={sessions} />;
  return <VariantA sessions={sessions} />;
}
