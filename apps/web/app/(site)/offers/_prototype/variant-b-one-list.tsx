/**
 * PROTOTYPE — B, _Una sola lista_. One ruled list, both directions, newest
 * first — the shape of a chat list, which DANE says more of this audience
 * already uses than email. Direction is the **first words** of every row, in
 * Inter, before the name in the display face: _Te escribió_ / _Le escribiste
 * a_. Nothing is hidden behind a switch; the waiting count heads the page.
 * The cost: a busy sender's rows can bury the one she has to answer.
 */

import { Separator } from "@repo/design-system/components/separator";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";
import { sentAgo, waitingCount } from "../_lib/messages";
import type { LabParams } from "./lab";
import type { Mailbox } from "./mailbox-data";
import { allItems, counterpart, EmptyMailbox, type Item, ItemBody, StateTag, waitsOnHer } from "./shared";

function Row({ item, now, open }: { item: Item; now: Date; open: boolean }) {
  const incoming = item.direction === "in";
  const Arrow = incoming ? ArrowDownLeftIcon : ArrowUpRightIcon;

  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-1 py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Arrow aria-hidden="true" className="size-4 shrink-0 self-center" />
            {incoming ? "Te escribió" : "Le escribiste a"}
          </span>
          <time
            dateTime={item.offer.sentAt.toISOString()}
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            {sentAgo(item.offer.sentAt, now)}
          </time>
        </span>
        <h2 className="font-heading text-foreground text-xl leading-7 font-medium text-pretty">
          {counterpart(item)}
        </h2>
        <span className="text-foreground line-clamp-2 group-open:hidden">
          {item.offer.workDescription}
        </span>
        <span className="flex min-w-0 items-center gap-2 pt-1">
          <StateTag item={item} />
          <span className="text-muted-foreground min-w-0 truncate text-sm group-open:hidden">
            {item.offer.payTerms}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="pb-6">
        <ItemBody item={item} />
      </div>
    </details>
  );
}

export function VariantB({
  mailbox,
  params,
  notices,
}: {
  readonly mailbox: Mailbox;
  readonly params: LabParams;
  readonly notices: React.ReactNode;
}) {
  const items = allItems(mailbox);
  const waiting = items.filter(waitsOnHer).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">Tus propuestas</h1>
        <p className="text-muted-foreground">
          Las que te escribieron y las que escribiste, de la más nueva a la más vieja. Una persona
          lee cada una antes de que llegue.
        </p>
        {mailbox.received.length > 0 ? (
          <p className="text-foreground font-medium">{waitingCount(waiting)}</p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <EmptyMailbox hasProfile={mailbox.hasProfile} />
      ) : (
        <ul className="ruled-page">
          {items.map((item, index) => (
            <li key={item.offer.id}>
              {index > 0 ? <Separator /> : null}
              <Row item={item} now={mailbox.now} open={params.open === item.offer.id} />
            </li>
          ))}
        </ul>
      )}

      {notices}
    </main>
  );
}
