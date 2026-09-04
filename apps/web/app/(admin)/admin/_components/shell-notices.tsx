import { Card } from "@repo/design-system/components/card";
import { InfoIcon } from "lucide-react";
import { profiles } from "@repo/domain/profiles";
import {
  coverageNotice,
  PUBLISH_SIGNAL_NOTE,
  PUBLISH_SIGNAL_TITLE,
  publishSignalBody,
} from "../_lib/messages";
import { liveSources, pendingSources } from "../_lib/queue-sources";
import { publishRateIsUnusual, publishRateWindowStart } from "../_lib/signals";

/**
 * The two things the shell says that are not about a section.
 */

/**
 * What the queue can and cannot see, stated where it is read.
 *
 * **A shell that silently reported four of five would be an instrument that
 * lies**, which is the acceptance criterion in as many words. Four sections have
 * no resolver, so their depth is unknown rather than zero, and an Admin reading a
 * shallow queue has to know which part of it is missing.
 *
 * **It is deliberately temporary and returns nothing once it is not needed**, so
 * the ticket that lands the fifth section removes a line that has already stopped
 * rendering rather than remembering to.
 */
export function Coverage() {
  const pending = pendingSources();
  if (pending.length === 0) return null;

  return (
    <p className="text-muted-foreground text-sm leading-5 text-pretty">
      {coverageNotice(
        liveSources().map((source) => source.label),
        pending.map((source) => source.label),
      )}
    </p>
  );
}

/**
 * The platform signal (C24): profiles published faster than people plausibly
 * arrive.
 *
 * **It renders in the shell because it is about the platform**, so it is true
 * wherever the Admin happens to be working — unlike the three per-profile signals,
 * which ride on the row of the profile they concern because that is where the
 * decision is made.
 *
 * **It is not a queue item and carries nothing to press.** Publishing is never
 * refused; the queue simply says the rate is unusual, and the note says so out
 * loud because an operator who found a warning with no action would go looking
 * for the action.
 *
 * **Nothing renders below the threshold.** A permanent "the rate is normal"
 * counter would be the dashboard the brief's anti-goals refuse — there are
 * exactly four signals on this surface and none of them is a vanity count.
 *
 * **A `Card` and not an `Alert`, and that is a semantic choice rather than a
 * visual one.** The registry's `Alert` carries `role="alert"`, which interrupts
 * whatever is being read — and this is the one element here whose copy says
 * outright that there is nothing to do about it. A notice that announces itself
 * over the Admin's work while telling them to carry on is the shape of a warning
 * nobody trusts twice. A source that failed keeps `Alert`, because that one says
 * the screen is understating how much work is left, which is what the role is
 * for.
 */
export async function PublishRateSignal({ now }: { now: Date }) {
  const published = await profiles.publishedSince(publishRateWindowStart(now));
  if (!publishRateIsUnusual(published)) return null;

  return (
    <Card className="flex flex-row items-start gap-3 p-4">
      <InfoIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-foreground text-sm leading-5 font-medium text-pretty">
          {PUBLISH_SIGNAL_TITLE}
        </p>
        <p className="text-muted-foreground text-sm leading-5 tabular-nums">
          {publishSignalBody(published)}
        </p>
        <p className="text-muted-foreground text-sm leading-5 text-pretty">{PUBLISH_SIGNAL_NOTE}</p>
      </div>
    </Card>
  );
}
