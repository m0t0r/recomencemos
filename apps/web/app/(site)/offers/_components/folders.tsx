/**
 * _Todas_, _Recibidas_, _Enviadas_ — for an Account with Offers on both sides,
 * and for nobody else.
 *
 * **Links wearing the registry's tabs, not tabs.** The registry's `Tabs` is
 * Base UI: it switches a panel in place and needs JavaScript to do it, and a
 * folder has to be an address (`?box=sent`) that the post-send redirect can
 * land on and a browser without JavaScript can follow. So each folder is a
 * `next/link` carrying the Tabs styling from `tabs-variants`, and no
 * `role="tab"` — a tab promises a panel on this page, and these go to another
 * address. `aria-current` says which one is shown.
 *
 * **The attributes are the primitive's, put down by hand.** The classes key on
 * what Base UI would render — `group/tabs` and `data-orientation` on the
 * wrapper, `data-variant` on the list, `data-active` on the current tab — so
 * the same attributes are here, read off a rendered registry `<Tabs>`.
 *
 * **No count on a folder.** A number beside _Recibidas_ is an unread badge by
 * another name, and the only number this page says is how many wait on her, in
 * words, in the heading block.
 */

import {
  tabsListVariants,
  tabsTriggerVariants,
} from "@repo/design-system/components/tabs-variants";
import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import { BOXES, type Box, boxQuery } from "../_lib/mailbox-view";
import { FOLDER_LABELS, FOLDERS_LABEL } from "../_lib/messages";

/**
 * The registry's grey track with the current folder raised, chosen over `line`
 * on the real route. One value for the attribute and the classes: the raised
 * shadow keys on `data-variant`, so the two drifting apart drops it silently.
 */
const VARIANT = "default";

export function Folders({
  box,
  detail,
}: {
  readonly box: Box;
  /** On an opened Offer the folder is where she is, not the page she is on. */
  readonly detail: boolean;
}) {
  return (
    <nav
      aria-label={FOLDERS_LABEL}
      data-slot="tabs"
      data-orientation="horizontal"
      className="group/tabs"
    >
      <ul
        data-slot="tabs-list"
        data-variant={VARIANT}
        className={cn(
          tabsListVariants({ variant: VARIANT }),
          // The track is 36 px and a folder is a 44 px tap target, so the track
          // grows to hold it rather than the tab shrinking under a thumb.
          "w-full group-data-horizontal/tabs:h-auto lg:flex-col lg:items-stretch",
        )}
      >
        {BOXES.map((folder) => (
          <li key={folder} className="flex flex-1 lg:flex-none">
            <Link
              href={`/offers${boxQuery(folder)}`}
              aria-current={folder === box ? (detail ? "true" : "page") : undefined}
              data-slot="tabs-trigger"
              data-active={folder === box ? "" : undefined}
              className={tabsTriggerVariants({ className: "min-h-11 lg:justify-start" })}
            >
              {FOLDER_LABELS[folder]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
