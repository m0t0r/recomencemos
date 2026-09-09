"use client";

/**
 * The one announcement the streamed grid makes: how many profiles arrived.
 *
 * **Once, as a count, when the boundary resolves — never per card.** A grid of
 * twenty-four cards that announced each one would say nothing useful twenty-four
 * times, and a grid that announced nothing would swap a skeleton for content in
 * silence.
 *
 * **Why the text is written after mount rather than rendered.** A live region
 * announces a *change* to its contents; a region that arrives already full is
 * frequently not announced at all, and this one arrives with the cards, because
 * Suspense replaces the fallback wholesale. So the server and the first client
 * render agree on an empty region — no hydration mismatch — and the effect fills
 * it a tick later, which is a change every screen reader is looking for.
 *
 * **With JavaScript unavailable this stays empty, and that is correct.** Nothing
 * streams without JavaScript: the document arrives complete and is read in
 * order, so there is no swap to announce. The announcement exists because of
 * streaming, and it is absent exactly where streaming is.
 */

import { useEffect, useState } from "react";
import { announcedCount } from "../../_lib/lists/messages";

export interface CountAnnouncementProps {
  readonly count: number;
  /**
   * The finished sentence, where the count is not a count of profiles.
   *
   * A parameter since story 6, because a third streamed list arrived that is not
   * a list of profiles: `/sent-offers` announces *3 propuestas*. It defaults to
   * the two public lists' own sentence, so neither of their call sites changed.
   *
   * **A string rather than the formatter, and that is not a preference.** This
   * module is `"use client"`, and a function cannot cross that boundary — a
   * Server Component passing one gets _"Functions cannot be passed directly to
   * Client Components"_ at render, which is a 500 rather than a build failure and
   * which no test in this suite can see. Found by opening the page (#24). The
   * plural rule stays in each surface's messages module, where the rest of its
   * copy is; what crosses is the sentence it produced.
   */
  readonly label?: string;
}

export function CountAnnouncement({ count, label }: CountAnnouncementProps) {
  const announcement = label ?? announcedCount(count);
  const [announced, setAnnounced] = useState("");

  /*
    The external system this effect synchronizes with is the accessibility tree,
    which is the case the rule carves out for itself. The extra render it objects
    to **is** the announcement: a live region that arrives already populated
    announces nothing, because what assistive technology reports is the *change*.
    Deriving the text during render, as the rule advises, would put it in the
    first commit and silence the thing this component exists to do.
  */
  useEffect(() => {
    // oxlint-disable-next-line set-state-in-effect, no-deriving-state-in-effects -- see above.
    setAnnounced(announcement);
  }, [announcement]);

  // `output` rather than a `p` with `role="status"`: its implicit role is `status`,
  // so the semantics are identical and the element says what it is.
  return (
    <output aria-live="polite" className="sr-only">
      {announced}
    </output>
  );
}
