"use client";

/**
 * PROTOTYPE — what the three "read a profile" variants share: the nameplate
 * and the Offer control's promise line. Each variant owns its page shape.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import { CITY_LABEL, displayName, initialOf, type MockWorker, skillsOf } from "../../_lib/mock";

export function Nameplate({ worker }: { readonly worker: MockWorker }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar size="xl" className="shrink-0" aria-hidden="true">
        <AvatarFallback>{initialOf(worker.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-foreground text-lg leading-6 font-medium">{displayName(worker)}</p>
        <p className="text-muted-foreground text-sm">{CITY_LABEL[worker.city]}</p>
      </div>
    </div>
  );
}

export function Chips({ worker }: { readonly worker: MockWorker }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {skillsOf(worker).map((skill) => (
        <li key={skill.slug}>
          <Badge variant="secondary" className="h-auto py-1 whitespace-normal">
            {skill.labelEs}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export const OFFER_PROMISE = "Una persona la lee antes de que le llegue, y no se puede cambiar.";
