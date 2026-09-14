/**
 * PROTOTYPE — C, _Quién sigue_. Three sections by who makes the next move,
 * each a `<section>` with an `<h2>`, date order inside each: what waits on
 * her, what she waits on, what is closed. Direction becomes a word on the row
 * rather than the page's structure. The refusal it brushes against: putting a
 * group on top is the platform arranging her Offers — the headings are neutral
 * and carry no count badge, but the owner has to judge whether that is enough.
 * An empty section is absent rather than announced.
 */

import { Separator } from "@repo/design-system/components/separator";
import { ChevronDownIcon } from "lucide-react";
import { sentAgo } from "../_lib/messages";
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
  waitsOnThem,
} from "./shared";

function Row({ item, now, open }: { item: Item; now: Date; open: boolean }) {
  return (
    <details open={open} className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="text-muted-foreground block text-sm">
            {item.direction === "in" ? "De" : "Para"}
          </span>
          <h3 className="font-heading text-foreground text-xl leading-7 font-medium text-pretty">
            {counterpart(item)}
          </h3>
        </span>
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

function Group({
  id,
  heading,
  lead,
  items,
  now,
  open,
}: {
  id: string;
  heading: string;
  lead: string;
  items: Item[];
  now: Date;
  open: string | undefined;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="font-heading text-foreground text-2xl leading-8 font-medium">
        {heading}
      </h2>
      <p className="text-muted-foreground text-sm">{lead}</p>
      <ul className="ruled-page mt-2">
        {items.map((item, index) => (
          <li key={item.offer.id}>
            {index > 0 ? <Separator /> : null}
            <Row item={item} now={now} open={open === item.offer.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VariantC({
  mailbox,
  params,
  notices,
}: {
  readonly mailbox: Mailbox;
  readonly params: LabParams;
  readonly notices: React.ReactNode;
}) {
  const items = allItems(mailbox);
  const yours = items.filter(waitsOnHer);
  const theirs = items.filter(waitsOnThem);
  const closed = items.filter((item) => !waitsOnHer(item) && !waitsOnThem(item));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
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
          <Group
            id="group-yours"
            heading="Esperan tu respuesta"
            lead="Te las enviaron. Tú decides si aceptas."
            items={yours}
            now={mailbox.now}
            open={params.open}
          />
          <Group
            id="group-theirs"
            heading="Esperas una respuesta"
            lead="Las enviaste. Una persona las lee y después decide quien las recibe."
            items={theirs}
            now={mailbox.now}
            open={params.open}
          />
          <Group
            id="group-closed"
            heading="Cerradas"
            lead="Aceptadas, no aceptadas o vencidas, en las dos direcciones."
            items={closed}
            now={mailbox.now}
            open={params.open}
          />
        </>
      )}

      {notices}
    </main>
  );
}
