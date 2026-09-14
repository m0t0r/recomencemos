/**
 * PROTOTYPE — D, _Correo_. The literal mail client, the owner's own picture:
 * folders (_Todas_, _Recibidas_, _Enviadas_), a list of compact rows, and a
 * reading pane. Every row is a **link** to `?open=<id>`, so each Offer has an
 * address and it works with no JavaScript. From `lg` up the three sit side by
 * side (Material's list-detail); on the phone the list and the Offer are two
 * screens, with a way back. Mail's vocabulary is kept out on purpose: no
 * _Bandeja de entrada_, no _Redactar_, no bold for unread.
 */

import { cn } from "@repo/design-system/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { sentAgo, waitingCount } from "../_lib/messages";
import type { LabParams } from "./lab";
import type { Mailbox } from "./mailbox-data";
import {
  allItems,
  counterpart,
  EmptyMailbox,
  type Item,
  ItemBody,
  StateTag,
  waitsOnHer,
} from "./shared";

type Box = "all" | "in" | "sent";

const FOLDERS: readonly { key: Box; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "in", label: "Recibidas" },
  { key: "sent", label: "Enviadas" },
];

function href(box: Box, open?: string) {
  return `?variant=D&box=${box}${open ? `&open=${open}` : ""}`;
}

function Folders({ box }: { box: Box }) {
  return (
    <nav aria-label="Qué propuestas ver">
      <ul className="flex gap-1 lg:flex-col">
        {FOLDERS.map((folder) => (
          <li key={folder.key} className="flex-1 lg:flex-none">
            <Link
              href={href(folder.key)}
              aria-current={box === folder.key ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium lg:justify-start",
                box === folder.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {folder.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ListRow({ item, box, now, current }: { item: Item; box: Box; now: Date; current: boolean }) {
  return (
    <Link
      href={href(box, item.offer.id)}
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex flex-col gap-1 px-3 py-3 lg:rounded-md",
        current ? "bg-secondary" : "hover:bg-accent",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-foreground min-w-0 truncate font-medium">
          <span className="text-muted-foreground font-normal">
            {item.direction === "in" ? "De " : "Para "}
          </span>
          {counterpart(item)}
        </span>
        <time
          dateTime={item.offer.sentAt.toISOString()}
          className="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
        >
          {sentAgo(item.offer.sentAt, now)}
        </time>
      </span>
      <span className="text-muted-foreground line-clamp-1 text-sm">{item.offer.workDescription}</span>
      <span className="flex min-w-0 items-center gap-2">
        <StateTag item={item} />
        <span className="text-muted-foreground min-w-0 truncate text-xs">{item.offer.payTerms}</span>
      </span>
    </Link>
  );
}

function Reading({ item, box }: { item: Item; box: Box }) {
  return (
    <article aria-labelledby="reading-heading" className="flex flex-col gap-5">
      <Link
        href={href(box)}
        className="text-muted-foreground flex min-h-11 items-center gap-1.5 text-sm underline-offset-4 hover:underline lg:hidden"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Volver a {FOLDERS.find((folder) => folder.key === box)?.label}
      </Link>
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">
          {item.direction === "in" ? "Te la envió" : "La enviaste a"}
        </span>
        <h2 id="reading-heading" className="font-heading text-foreground text-2xl leading-8 font-medium">
          {counterpart(item)}
        </h2>
        <span className="pt-1">
          <StateTag item={item} />
        </span>
      </header>
      <ItemBody item={item} />
    </article>
  );
}

export function VariantD({
  mailbox,
  params,
  notices,
}: {
  readonly mailbox: Mailbox;
  readonly params: LabParams;
  readonly notices: React.ReactNode;
}) {
  const items = allItems(mailbox);
  const box: Box = params.box === "in" || params.box === "sent" ? params.box : "all";
  const shown = items.filter(
    (item) => box === "all" || (box === "in" ? item.direction === "in" : item.direction === "out"),
  );
  const opened = items.find((item) => item.offer.id === params.open);
  const waiting = items.filter(waitsOnHer).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className={cn("flex flex-col gap-2", opened ? "hidden lg:flex" : undefined)}>
        <h1 className="page-heading">Tus propuestas</h1>
        {mailbox.received.length > 0 ? (
          <p className="text-foreground font-medium">{waitingCount(waiting)}</p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <EmptyMailbox hasProfile={mailbox.hasProfile} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[11rem_minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
          <div className={cn(opened ? "hidden lg:block" : undefined)}>
            <Folders box={box} />
          </div>

          <ul
            className={cn(
              "divide-border flex flex-col divide-y lg:divide-y-0",
              opened ? "hidden lg:flex" : undefined,
            )}
          >
            {shown.map((item) => (
              <li key={item.offer.id}>
                <ListRow item={item} box={box} now={mailbox.now} current={opened?.offer.id === item.offer.id} />
              </li>
            ))}
          </ul>

          <div className={cn("lg:border-border lg:border-l lg:pl-8", opened ? undefined : "hidden lg:block")}>
            {opened ? (
              <Reading item={opened} box={box} />
            ) : (
              <p className="text-muted-foreground pt-3">Elige una propuesta de la lista para leerla.</p>
            )}
          </div>
        </div>
      )}

      {notices}
    </main>
  );
}
