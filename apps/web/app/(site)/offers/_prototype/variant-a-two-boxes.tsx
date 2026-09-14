/**
 * PROTOTYPE — A, _Dos cajones_. The mail folder model: two plain links,
 * _Recibidas_ and _Enviadas_, with `aria-current`, and one list under them.
 * Links rather than ARIA tabs so it works with no JavaScript and every box has
 * an address (`?box=sent`). No count on either segment — a number on a folder
 * is an unread badge by another name. The cost the research names: whatever
 * waits in the other box is hidden, so the other box's one fact is said in a
 * sentence under the switch.
 */

import { Separator } from "@repo/design-system/components/separator";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { sentAgo, waitingCount } from "../_lib/messages";
import type { LabParams } from "./lab";
import type { Mailbox } from "./mailbox-data";
import { allItems, counterpart, EmptyMailbox, type Item, ItemBody, StateTag, waitsOnHer } from "./shared";

function Row({ item, now, open }: { item: Item; now: Date; open: boolean }) {
  return (
    <details open={open} className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-5 [&::-webkit-details-marker]:hidden">
        <h2 className="font-heading text-foreground min-w-0 text-xl leading-7 font-medium text-pretty">
          {counterpart(item)}
        </h2>
        <time
          dateTime={item.offer.sentAt.toISOString()}
          className="text-muted-foreground pt-1 text-sm whitespace-nowrap"
        >
          {sentAgo(item.offer.sentAt, now)}
        </time>
        <span className="text-foreground col-span-2 line-clamp-2 group-open:hidden">
          {item.offer.workDescription}
        </span>
        <span className="col-span-2 flex min-w-0 items-center gap-2 pt-1">
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

export function VariantA({
  mailbox,
  params,
  notices,
}: {
  readonly mailbox: Mailbox;
  readonly params: LabParams;
  readonly notices: React.ReactNode;
}) {
  const items = allItems(mailbox);
  const incoming = items.filter((item) => item.direction === "in");
  const outgoing = items.filter((item) => item.direction === "out");
  const waiting = incoming.filter(waitsOnHer).length;

  // She lands where she has a profile; an Account that has only ever sent lands on Enviadas.
  const box = params.box === "sent" || params.box === "in" ? params.box : mailbox.hasProfile ? "in" : "sent";
  const shown = box === "in" ? incoming : outgoing;
  const bothRoles = incoming.length > 0 && outgoing.length > 0;

  const segment = (key: "in" | "sent", label: string) => (
    <Link
      href={`?variant=A&box=${key}`}
      aria-current={box === key ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium",
        box === key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">Tus propuestas</h1>
        <p className="text-muted-foreground">
          Una persona lee cada propuesta antes de que llegue. Tu teléfono no sale de aquí hasta que
          aceptes una.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyMailbox hasProfile={mailbox.hasProfile} />
      ) : (
        <>
          {bothRoles || mailbox.hasProfile ? (
            <nav aria-label="Qué propuestas ver" className="border-input grid grid-cols-2 gap-1 rounded-lg border p-1">
              {segment("in", "Recibidas")}
              {segment("sent", "Enviadas")}
            </nav>
          ) : null}

          {box === "in" ? (
            <p className="text-foreground font-medium">{waitingCount(waiting)}</p>
          ) : waiting > 0 ? (
            <p className="text-muted-foreground text-sm">
              {waiting === 1
                ? "En Recibidas, 1 propuesta espera tu respuesta."
                : `En Recibidas, ${waiting} propuestas esperan tu respuesta.`}{" "}
              <Link href="?variant=A&box=in" className="text-foreground underline underline-offset-4">
                Ir a Recibidas
              </Link>
            </p>
          ) : null}

          {shown.length === 0 ? (
            <p className="text-muted-foreground">
              {box === "in"
                ? "Todavía no te ha llegado ninguna propuesta."
                : "Todavía no has enviado ninguna propuesta."}
            </p>
          ) : (
            <ul className="ruled-page">
              {shown.map((item, index) => (
                <li key={item.offer.id}>
                  {index > 0 ? <Separator /> : null}
                  <Row item={item} now={mailbox.now} open={params.open === item.offer.id} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {notices}
    </main>
  );
}
