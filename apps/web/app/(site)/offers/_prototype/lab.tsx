/**
 * PROTOTYPE — the merged-mailbox lab on `/offers`: four structures for one
 * page holding what reached her and what she sent. `?variant=A|B|C|D`; no
 * parameter is today's production page. The strip at the top and the bar at
 * the bottom are deliberately off-palette so nobody judges them as design.
 */

import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import type { Mailbox } from "./mailbox-data";
import type { MailboxVariant } from "./variant";
import { VariantA } from "./variant-a-two-boxes";
import { VariantB } from "./variant-b-one-list";
import { VariantC } from "./variant-c-who-acts";
import { VariantD } from "./variant-d-mail";

export const VARIANTS: readonly MailboxVariant[] = [
  {
    key: "A",
    name: "Dos cajones",
    bet: "Mail folders — Recibidas / Enviadas as two plain links; one list at a time, so the two different jobs never share a screen.",
  },
  {
    key: "B",
    name: "Una sola lista",
    bet: "One list, newest first, like a chat list — every row says its direction in words first, nothing is hidden behind a switch.",
  },
  {
    key: "C",
    name: "Quién sigue",
    bet: "Grouped by who acts next — what waits on you, what you wait on, what is closed. Direction is a detail; the next move is the structure.",
  },
  {
    key: "D",
    name: "Correo",
    bet: "The literal mail client — folders, a list of addressable rows, a reading pane on desktop; list then detail on the phone.",
  },
];

export interface LabParams {
  readonly box?: string | undefined;
  readonly open?: string | undefined;
}

export function MailboxLab({
  variant,
  mailbox,
  params,
  notices,
}: {
  readonly variant: MailboxVariant;
  readonly mailbox: Mailbox;
  readonly params: LabParams;
  readonly notices: React.ReactNode;
}) {
  return (
    <>
      <div className="border-border bg-muted border-b px-4 py-2 font-mono text-xs">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-foreground font-medium">laboratorio · propuestas en un solo lugar</span>
          <span className="text-muted-foreground">
            ¿Cómo se ve una página con lo que recibes y lo que envías?
          </span>
        </div>
        <div className="text-muted-foreground mx-auto mt-1 w-full max-w-5xl">
          <span className="text-foreground">
            {variant.key} · {variant.name}:
          </span>{" "}
          {variant.bet}
        </div>
      </div>

      {variant.key === "A" ? <VariantA mailbox={mailbox} params={params} notices={notices} /> : null}
      {variant.key === "B" ? <VariantB mailbox={mailbox} params={params} notices={notices} /> : null}
      {variant.key === "C" ? <VariantC mailbox={mailbox} params={params} notices={notices} /> : null}
      {variant.key === "D" ? <VariantD mailbox={mailbox} params={params} notices={notices} /> : null}

      <div className="h-20" aria-hidden="true" />
      <PrototypeSwitcher variants={VARIANTS} current={variant.key} />
    </>
  );
}
