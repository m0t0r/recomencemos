"use client";

/**
 * PROTOTYPE — the Wall row as she sees it on her own page, shared by the
 * three "my notebook" variants.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import { CITY_LABEL, displayName, initialOf, type MockWorker, skillsOf } from "../../_lib/mock";

export function Card({ worker }: { readonly worker: MockWorker }) {
  return (
    <article className="flex gap-4 py-5">
      <Avatar size="lg" className="shrink-0" aria-hidden="true">
        <AvatarFallback>{initialOf(worker.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-heading text-foreground text-2xl leading-7 font-medium text-pretty">
            {worker.headline}
          </p>
          <p className="text-muted-foreground text-sm">
            {displayName(worker)} · {CITY_LABEL[worker.city]}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {skillsOf(worker).map((skill) => (
            <li key={skill.slug}>
              <Badge variant="secondary" className="h-auto py-1 whitespace-normal">
                {skill.labelEs}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
