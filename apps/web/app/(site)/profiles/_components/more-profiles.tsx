"use client";

/**
 * Infinite scroll on `/profiles`, built as an **enhancement of the link** rather
 * than as a replacement for it.
 *
 * **The link is the mechanism and the scrolling is the sugar**, which is what
 * keeps two of this ticket's own criteria true. With JavaScript unavailable the
 * `<a href="/profiles?after=…">` is what the reader — and a crawler — follows,
 * so the whole list stays reachable and indexable; with JavaScript the same
 * cursor is handed to a Server Action and the rows are appended in place. The
 * link is never removed, only relabelled while a page is in flight.
 *
 * **The observer loads one page ahead of the fold, never a page per pixel.** A
 * request is in flight or it is not, and `pending` is what stops the observer
 * firing again while the first one is still going — the failure mode of every
 * hand-written infinite scroll.
 *
 * **A failure leaves the link.** The action returns rows or it does not; if it
 * does not, the observer stops and the reader is told once, with the link still
 * there to press. Silence plus a spinner is what this must never become.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import type { PublicProfile } from "@repo/domain/profiles";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileRow } from "../../_components/profile-list/profile-row";
import { announcedMore } from "../../_lib/lists/messages";
import { loadMoreProfiles } from "../actions";
import { BROWSE_MORE, BROWSE_MORE_FAILED, BROWSE_MORE_LOADING } from "../_lib/messages";

export function MoreProfiles({ initialCursor }: { readonly initialCursor: string }) {
  const [rows, setRows] = useState<readonly PublicProfile[]>([]);
  /*
    How many arrived on the **last** page, which is not `rows.length`.
    Announcing the running total said "48 perfiles más" when 24 had come.
  */
  const [lastAppended, setLastAppended] = useState(0);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (pending || cursor === null) return;

    setPending(true);
    const result = await loadMoreProfiles({ after: cursor });
    setPending(false);

    const page = result?.data;

    if (!page) {
      // Stop asking. The link below is still there, and it is a navigation
      // rather than another call through the path that just failed.
      setFailed(true);
      return;
    }

    setRows((current) => [...current, ...page.profiles]);
    setLastAppended(page.profiles.length);
    setCursor(page.nextCursor);
  }, [cursor, pending]);

  useEffect(() => {
    const node = sentinel.current;
    if (node === null || cursor === null || failed) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore]);

  /*
    Everything below is an `li`: this renders inside the list's own `ul`, so the
    appended rows are siblings of the first page's rather than a second list
    beside it — which is what keeps "24 profiles" one list to a screen reader
    instead of two.
  */
  return (
    <>
      {rows.map((profile) => (
        <li key={profile.slug}>
          <ProfileRow profile={profile} separated />
        </li>
      ))}

      <li>
        {/*
          How many rows scrolling has appended, said as *more* rather than as a
          count — the first announcement was the page total, so a bare number
          here would read as the list having shrunk. Empty until there is
          something to say, for the reason `count-announcement.tsx` gives: a live
          region that arrives already populated announces nothing.
        */}
        <output aria-live="polite" className="sr-only">
          {lastAppended > 0 ? announcedMore(lastAppended, rows.length) : ""}
        </output>

        {cursor !== null ? (
          <div ref={sentinel} className="flex flex-col items-start gap-2 py-6">
            {failed ? <p className="text-muted-foreground text-sm">{BROWSE_MORE_FAILED}</p> : null}
            <Link
              href={`/profiles?after=${cursor}`}
              className={buttonVariants({ variant: "outline" })}
              aria-busy={pending}
            >
              {pending ? BROWSE_MORE_LOADING : BROWSE_MORE}
            </Link>
          </div>
        ) : null}
      </li>
    </>
  );
}
