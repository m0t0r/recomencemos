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
   * What the count is *of*, as the finished sentence.
   *
   * A parameter since story 6, because a third streamed list arrived that is not
   * a list of profiles: `/sent-offers` announces *3 propuestas*. The default is
   * the two public lists' own sentence, so neither call site changed — and the
   * noun stays in a messages module rather than being assembled here from a
   * number and a word, which is how a plural rule ends up living in a component.
   */
  readonly announce?: (count: number) => string;
}

export function CountAnnouncement({ count, announce = announcedCount }: CountAnnouncementProps) {
  const [announcement, setAnnouncement] = useState("");

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
    setAnnouncement(announce(count));
  }, [announce, count]);

  // `output` rather than a `p` with `role="status"`: its implicit role is `status`,
  // so the semantics are identical and the element says what it is.
  return (
    <output aria-live="polite" className="sr-only">
      {announcement}
    </output>
  );
}
