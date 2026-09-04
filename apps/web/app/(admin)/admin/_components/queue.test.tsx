/**
 * The queue shell's states, which are what #17 actually ships of the queue.
 *
 * Seam 3 covers `/admin` running — the gate, the 403, the header. What belongs
 * here is the part a running server cannot show cheaply: the four states, driven
 * against fixtures, including the two that will not occur in production until a
 * later story adds a source that can fail or fill.
 *
 * **Queried by role, not by selector.** The accessibility tree is what NFR20 is
 * about, and it is where these components' bugs live: a skeleton without its
 * source name and a failure without its `alert` role are both invisible to a CSS
 * selector and both are the finding.
 */

import { render, screen } from "@testing-library/react";
import {
  OldestItem,
  QueueEmpty,
  SectionBadge,
  SectionBadgeAbsent,
  SectionNotLive,
  SourceBranch,
  SourceFailed,
  SourceSkeleton,
} from "./queue";
import {
  PAST_BAND_MARKER,
  QUEUE_EMPTY_TITLE,
  SECTION_NOT_LIVE_ANNOUNCEMENT,
  SECTION_NOT_LIVE_TITLE,
} from "../_lib/messages";
import type { QueueBranch } from "../_lib/queue-sources";

describe("the oldest item", () => {
  it("renders the age in hours", () => {
    render(<OldestItem hours={19} />);
    expect(screen.getByText("19 h")).toBeInTheDocument();
  });

  /**
   * **The acceptance criterion, as one case**: _"queue empty is a real and good
   * state and **says the oldest-item age is zero**"_. A first draft rendered a
   * sentence here instead, on the argument that a set with no members has no age;
   * this is what says the criterion won. It is a health figure read against NFR7's
   * 24-hour band, and 0 is the good value an Admin scans for.
   */
  it("renders a zero rather than a sentence when nothing is waiting", () => {
    render(<OldestItem hours={0} />);
    expect(screen.getByText("0 h")).toBeInTheDocument();
  });
});

describe("the empty queue", () => {
  /**
   * The acceptance criterion: _"queue empty is a real and good state"_. Asserted
   * as the presence of the sentence that says so, because the failure this guards
   * is somebody replacing it with a generic "no hay nada" — which on a moderation
   * queue is indistinguishable from a screen that failed to load.
   */
  it("says the queue is empty rather than that there is no data", () => {
    render(<QueueEmpty />);
    expect(screen.getByText(QUEUE_EMPTY_TITLE)).toBeInTheDocument();
  });
});

describe("a source that failed", () => {
  /**
   * _"A source failed: say **which**, because a silently missing source is an
   * unreviewed Offer."_ The name in the sentence is the requirement.
   */
  it("names the source that failed", () => {
    render(<SourceFailed label="Reportes" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reportes");
  });

  /**
   * `alert` rather than `status`, unlike every other announcement in this app.
   * The others report what the Admin just did; this one reports that the screen is
   * understating how much work is left, which is worth interrupting for.
   */
  it("announces assertively, because the queue is understating itself", () => {
    render(<SourceFailed label="Reportes" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("a source that is still loading", () => {
  /**
   * The Suspense table asks for _"skeleton rows per source, **each labelled with
   * its source**"_. An unlabelled skeleton is reachable by `querySelector` and by
   * nothing a screen-reader user has — and it lets a source still arriving be read
   * as a source with nothing in it, which is the same failure as an unnamed
   * error one state earlier.
   */
  it("is labelled with the source it is waiting for", () => {
    render(<SourceSkeleton label="Fotos" />);
    expect(screen.getByLabelText("Fotos")).toHaveAttribute("aria-busy", "true");
  });
});

describe("a loaded source", () => {
  const branch: QueueBranch = {
    items: [
      { id: "1", summary: "Oferta de Ana", arrivedAt: new Date("2026-08-29T09:00:00Z") },
      { id: "2", summary: "Oferta de Luis", arrivedAt: new Date("2026-08-29T10:00:00Z") },
    ],
    // Deliberately larger than `items`: each branch is `LIMIT`-capped for display
    // while its count is computed over the whole branch.
    total: 412,
    oldestArrivedAt: new Date("2026-08-29T09:00:00Z"),
  };

  it("lists the items it was given", () => {
    render(<SourceBranch branch={branch} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders each item's summary in full, so nothing is acted on unread", () => {
    render(<SourceBranch branch={branch} />);
    expect(screen.getByText("Oferta de Ana")).toBeInTheDocument();
    expect(screen.getByText("Oferta de Luis")).toBeInTheDocument();
  });
});

describe("a section's figure in the nav", () => {
  /**
   * **The branch's total, never `items.length`.** This is C55 as a test: a nav
   * item reporting the capped length would say 20 while 412 Offers wait, which is
   * NFR7's depth detector reading a number that cannot exceed the display cap.
   * The figure moved here from the branch card when the queue became five routes,
   * and this is the assertion following it.
   */
  it("reports the whole branch's count", () => {
    render(<SectionBadge total={412} late={false} />);
    expect(screen.getByText("412")).toBeInTheDocument();
  });

  /**
   * A bare number read aloud beside a section name is a list position as easily
   * as a backlog. The visible figure is `aria-hidden` and this phrase is what is
   * announced — one fact rendered twice rather than two that can drift.
   */
  it("announces the count as a phrase rather than as a bare number", () => {
    render(<SectionBadge total={412} late={false} />);
    expect(screen.getByText("412 pendientes")).toBeInTheDocument();
  });

  it("says one pendiente rather than one pendientes", () => {
    render(<SectionBadge total={1} late={false} />);
    expect(screen.getByText("1 pendiente")).toBeInTheDocument();
  });

  /**
   * **The urgency marker is a word, not a colour** — the acceptance criterion in
   * as many words, and WCAG 2.2 AA 1.4.1 again. Asserted as text rather than as a
   * class, because a class assertion would pass on the day somebody replaced the
   * word with a red dot.
   */
  it("marks a late section with text and not with colour alone", () => {
    render(<SectionBadge total={3} late />);
    expect(screen.getByText(PAST_BAND_MARKER)).toBeInTheDocument();
  });

  it("says nothing about lateness when the section is inside its band", () => {
    render(<SectionBadge total={3} late={false} />);
    expect(screen.queryByText(PAST_BAND_MARKER)).not.toBeInTheDocument();
  });

  /**
   * **A section with no resolver has no count, and never a zero.** Zero is the
   * good news an Admin scans for; reporting it for a branch nobody queried is the
   * instrument that lies. The dash is what a sighted reader sees and the phrase is
   * what is announced, because "—" alone is punctuation or silence.
   */
  it("shows a dash rather than a zero for a section that is not counting", () => {
    render(<SectionBadgeAbsent />);
    expect(screen.getByText(SECTION_NOT_LIVE_ANNOUNCEMENT)).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("a section that is not live", () => {
  /**
   * **It must not read as the empty state**, which is the whole reason it is a
   * second component. Empty means everything was read; this means nothing was
   * ever asked, and an Admin who read one as the other would conclude a branch
   * was clear while it is not being counted at all.
   */
  it("says it is not counting rather than that there is nothing", () => {
    render(<SectionNotLive />);
    expect(screen.getByText(SECTION_NOT_LIVE_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(QUEUE_EMPTY_TITLE)).not.toBeInTheDocument();
  });
});
