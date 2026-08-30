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
import { OldestItem, QueueEmpty, SourceBranch, SourceFailed, SourceSkeleton } from "./queue";
import { QUEUE_EMPTY_TITLE } from "../_lib/messages";
import type { QueueBranch, QueueSource } from "../_lib/queue-sources";

const source: QueueSource = {
  key: "offers",
  label: "Ofertas sin revisar",
  load: async () => ({ items: [], total: 0, oldestArrivedAt: null }),
};

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

  /**
   * **The branch's total, never `items.length`.** This is C55 as a test: a card
   * reporting the capped length would say 2 while 412 Offers wait, which is NFR7's
   * depth detector reading a number that cannot exceed the display cap.
   */
  it("reports the whole branch's count, not the capped page's", () => {
    render(<SourceBranch source={source} branch={branch} />);
    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("lists the items it was given", () => {
    render(<SourceBranch source={source} branch={branch} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("names the source as a heading, so the queue is navigable by them", () => {
    render(<SourceBranch source={source} branch={branch} />);
    expect(screen.getByRole("heading", { name: source.label })).toBeInTheDocument();
  });
});
