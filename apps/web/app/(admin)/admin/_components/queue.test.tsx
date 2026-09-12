/**
 * The queue's states, driven against fixtures.
 *
 * Seam 3 covers `/admin` running — the gate, the 403, the header. What belongs
 * here is the part a running server cannot show cheaply: the states, including
 * the ones that will not occur in production until a source can fail or fill.
 *
 * **Queried by role, not by selector.** The accessibility tree is what NFR20 is
 * about, and it is where these components' bugs live: a skeleton without its name
 * and a failure without its `alert` role are both invisible to a CSS selector and
 * both are the finding.
 */

import { render, screen } from "@testing-library/react";
import { PastBandMarker, QueueEmpty, QueueHeadline, QueueSkeleton, SourceFailed } from "./queue";
import { PAST_BAND_MARKER, QUEUE_EMPTY_TITLE, QUEUE_LIST_LABEL } from "../_lib/messages";

describe("the headline", () => {
  it("renders the age of the oldest item in hours", () => {
    render(<QueueHeadline hours={19} waiting={3} />);
    expect(screen.getByText("19 h")).toBeInTheDocument();
  });

  /**
   * **The acceptance criterion, as one case**: _"queue empty is a real and good
   * state and **says the oldest-item age is zero**"_. It is a health figure read
   * against NFR7's 24-hour band, and 0 is the good value an Admin scans for.
   */
  it("renders a zero rather than a sentence when nothing is waiting", () => {
    render(<QueueHeadline hours={0} waiting={0} />);
    expect(screen.getByText("0 h")).toBeInTheDocument();
  });

  /**
   * **The count it is given, as a phrase** — the page hands it the whole
   * branches' total (C55), and a bare number beside a heading is a list position
   * as easily as a backlog.
   */
  it("says how much is waiting behind it", () => {
    render(<QueueHeadline hours={19} waiting={412} />);
    expect(screen.getByText("412 por revisar")).toBeInTheDocument();
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

describe("the list while it loads", () => {
  /**
   * The Suspense table asks for skeleton rows **labelled** with what they wait
   * for. An unlabelled skeleton is reachable by `querySelector` and by nothing a
   * screen-reader user has — and it lets a list still arriving be read as a list
   * with nothing in it.
   */
  it("is labelled with what it is waiting for", () => {
    render(<QueueSkeleton label={QUEUE_LIST_LABEL} />);
    expect(screen.getByLabelText(QUEUE_LIST_LABEL)).toHaveAttribute("aria-busy", "true");
  });
});

/**
 * **The urgency marker is a word, not a colour** — WCAG 2.2 AA 1.4.1. Asserted
 * as text rather than as a class, because a class assertion would pass on the day
 * somebody replaced the word with a red dot.
 */
it("marks lateness with text and not with colour alone", () => {
  render(<PastBandMarker />);
  expect(screen.getByText(PAST_BAND_MARKER)).toBeInTheDocument();
});
